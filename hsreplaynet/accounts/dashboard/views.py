from allauth.socialaccount.models import SocialAccount
from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views.generic import (
	CreateView, DeleteView, ListView, TemplateView, UpdateView, View
)
from django_reflinks.models import ReferralLink
from oauth2_provider.generators import generate_client_secret
from oauth2_provider.models import AccessToken, get_application_model
from shortuuid import ShortUUID

from hearthsim_identity.accounts.models import AccountDeleteRequest, User
from hsreplaynet.features.utils import feature_enabled_for_user
from hsreplaynet.utils import log
from hsreplaynet.utils.html import RequestMetaMixin
from hsreplaynet.utils.influx import influx_metric
from hsreplaynet.webhooks.models import WebhookDelivery, WebhookEndpoint


##
# Account management

class EditAccountView(LoginRequiredMixin, RequestMetaMixin, UpdateView):
	template_name = "account/edit.html"
	model = User
	fields = [
		"default_replay_visibility", "joust_autoplay", "locale", "exclude_from_statistics"
	]
	success_url = "/account/"
	title = "My Account"

	def get_object(self, queryset=None):
		return self.request.user

	def get_context_data(self, **kwargs):
		context = super().get_context_data(**kwargs)

		if feature_enabled_for_user("reflinks", self.request.user):
			try:
				context["reflink"] = ReferralLink.objects.get(user=self.request.user)
			except ReferralLink.DoesNotExist:
				context["reflink"] = ReferralLink.objects.create(
					identifier=ShortUUID().uuid()[:6], user=self.request.user
				)

		return context


class APIAccountView(LoginRequiredMixin, RequestMetaMixin, View):
	template_name = "account/api.html"
	title = "API Access"

	def get(self, request):
		context = {
			"tokens": request.user.auth_tokens.all(),
			"webhooks": request.user.webhook_endpoints.filter(is_deleted=False),
		}
		return render(request, self.template_name, context)


class DeleteAccountView(LoginRequiredMixin, RequestMetaMixin, TemplateView):
	template_name = "account/delete.html"
	success_url = reverse_lazy("home")
	title = "Delete Account"

	def can_delete(self):
		customer = self.request.user.stripe_customer
		subscriptions = customer.active_subscriptions.filter(cancel_at_period_end=False)
		if subscriptions.count():
			# If the user has any active subscriptions that they did not cancel,
			# we prevent them from deleting their account in order to ensure
			# they confirm the cancellation of their subscription.
			return False
		return True

	def get_context_data(self, **kwargs):
		context = super().get_context_data(**kwargs)
		context["can_delete"] = self.can_delete()
		return context

	def post(self, request):
		if not request.POST.get("delete_confirm"):
			return redirect("account_delete")
		delete_request, _ = AccountDeleteRequest.objects.get_or_create(user=request.user)
		delete_request.reason = request.POST.get("delete_reason")
		delete_request.delete_replay_data = bool(request.POST.get("delete_replays"))
		delete_request.save()
		logout(self.request)
		return redirect(self.success_url)


class MakePrimaryView(LoginRequiredMixin, View):
	success_url = reverse_lazy("socialaccount_connections")

	def post(self, request):
		self.request = request

		account = request.POST.get("account")
		try:
			socacc = SocialAccount.objects.get(id=account)
		except SocialAccount.DoesNotExist:
			return self.error(1)
		if socacc.user != request.user:
			# return HttpResponseForbidden("%r does not belong to you." % (socacc))
			return self.error(2)

		if socacc.provider != "battlenet":
			raise NotImplementedError("Making non-battlenet account primary is not implemented")

		battletag = socacc.extra_data.get("battletag")
		if battletag:
			if User.objects.filter(username=battletag).exists():
				# A user with that username already exists
				return self.error(3)
			request.user.battletag = battletag
			request.user.username = battletag
			request.user.save()

		return self.complete()

	def error(self, id):
		log.warning("%r got error %r when making account primary" % (self.request.user, id))
		influx_metric("hsreplaynet_make_primary", {"count": 1}, error=id)
		messages.error(self.request, "Could not make account primary.")
		return redirect(self.success_url)

	def complete(self, success=True):
		influx_metric("hsreplaynet_make_primary", {"count": 1})
		return redirect(self.success_url)


##
# Webhooks management


class WebhookFormMixin(LoginRequiredMixin, RequestMetaMixin):
	model = WebhookEndpoint
	template_name = "webhooks/detail.html"
	fields = ["url", "is_active"]
	success_url = reverse_lazy("account_api")


class WebhookCreateView(WebhookFormMixin, CreateView):
	title = "Create a webhook"

	def form_valid(self, form):
		form.instance.creator = self.request.user
		form.instance.user = self.request.user
		return super().form_valid(form)


class WebhookUpdateView(WebhookFormMixin, UpdateView):
	context_object_name = "webhook"
	deliveries_limit = 25
	title = "Update a webhook"

	def get_queryset(self):
		qs = super().get_queryset()
		return qs.filter(user=self.request.user, is_deleted=False)

	def get_context_data(self, **kwargs):
		context = super().get_context_data(**kwargs)
		context["deliveries"] = WebhookDelivery.objects.filter(
			webhook__endpoint=context["webhook"]
		)[:self.deliveries_limit]
		return context


class WebhookDeleteView(WebhookFormMixin, DeleteView):
	def get_queryset(self):
		qs = super().get_queryset()
		return qs.filter(user=self.request.user, is_deleted=False)


##
# OAuth2 management

Application = get_application_model()


class ApplicationBaseView(LoginRequiredMixin, RequestMetaMixin, View):
	model = Application

	def get_queryset(self):
		return self.model.objects.filter(user=self.request.user)


class ApplicationUpdateView(ApplicationBaseView, UpdateView):
	template_name = "oauth2/application_update.html"
	fields = ("name", "description", "homepage", "redirect_uris")
	title = "Your OAuth Application"


class ApplicationListView(ApplicationBaseView, ListView):
	"""
	Mixed view that lists both the authorized apps for the user,
	as well as the application the user *owns*.
	"""

	template_name = "account/oauth_apps.html"
	title = "OAuth Applications"

	def get_context_data(self, **kwargs):
		context = super().get_context_data(**kwargs)
		authorized_apps = AccessToken.objects.filter(
			user=self.request.user,
		).distinct("application")
		context["authorized_apps"] = authorized_apps
		return context


class ResetSecretView(ApplicationBaseView):
	def post(self, request, **kwargs):
		app = get_object_or_404(self.get_queryset(), pk=kwargs["pk"])
		app.client_secret = generate_client_secret()
		app.save()
		return redirect(app)


class RevokeAllTokensView(ApplicationBaseView):
	def post(self, request, **kwargs):
		app = get_object_or_404(self.get_queryset(), pk=kwargs["pk"])
		app.accesstoken_set.all().delete()
		return redirect(app)


class UserRevocationView(LoginRequiredMixin, View):
	model = Application
	next = reverse_lazy("oauth2_app_list")

	def post(self, request):
		client_id = request.POST.get("client_id")
		if client_id:
			app = get_object_or_404(self.model, client_id=client_id)
			tokens = app.accesstoken_set.filter(user=request.user)
			tokens.delete()
		return redirect(self.next)
