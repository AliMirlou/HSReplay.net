from django.contrib.auth.mixins import LoginRequiredMixin
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView

from hsreplaynet.features.decorators import view_requires_feature_access
from hsreplaynet.web.html import RequestMetaMixin


@method_decorator(view_requires_feature_access("packs"), name="dispatch")
class PackListView(LoginRequiredMixin, RequestMetaMixin, TemplateView):
	template_name = "profiles/packs.html"
