from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django_reflinks.models import ReferralHit
from djpaypal.models import WebhookEvent
from djstripe.models import Event
from djstripe.settings import _get_idempotency_key

from .models import Referral


def check_for_referrals(user) -> bool:
	if user_subscription_events_count(user) != 1:
		return False

	referral_hit = user_referred_by(user)
	if not referral_hit:
		return False

	if user == referral_hit.referral_link.user:
		# Guard against self-referrals
		return False

	referral, created = Referral.objects.get_or_create(
		hit_user=user, defaults={
			"referral_hit": referral_hit,
			"credited_amount": 250,
			"credited_user": referral_hit.referral_link.user,
		}
	)

	return process_referral(referral)


def process_referral(referral) -> bool:
	user_to_credit = referral.credited_user

	if referral.processed:
		return False

	ik = _get_idempotency_key(
		"customer", f"referral:{referral.hit_user.pk}",
		settings.STRIPE_LIVE_MODE
	)

	customer_to_credit = user_to_credit.stripe_customer.api_retrieve()
	customer_to_credit.account_balance -= referral.credited_amount
	customer_to_credit.save(idempotency_key=ik)

	referral.processed = True
	if customer_to_credit.last_response:
		referral.credit_request_id = customer_to_credit.last_response.request_id
	referral.save()

	return True


def user_referred_by(user):
	time_window = timezone.now() - timedelta(days=14)

	if user.date_joined < time_window:
		return

	hits = ReferralHit.objects.filter(hit_user=user, created__gt=time_window)

	if not hits.exists():
		return

	return hits.latest("created")


def user_stripe_subscribe_events(user):
	if not user.is_authenticated:
		return []

	customer_id = user.stripe_customer.stripe_id

	return Event.objects.filter(
		type="customer.subscription.created",
		data__object__customer=customer_id
	)


def user_paypal_subscribe_events(user):
	if not user.is_authenticated:
		return []

	# https://code.djangoproject.com/ticket/28872
	ret = []
	for payer_id in list(user.paypal_payers.values_list("id", flat=True)):
		ret += WebhookEvent.objects.filter(
			event_type="BILLING.SUBSCRIPTION.CREATED",
			resource__payer__payer_info__payer_id=payer_id
		)

	return ret


def user_subscription_events_count(user) -> int:
	stripe_events = user_stripe_subscribe_events(user)
	paypal_events = user_paypal_subscribe_events(user)

	return len(stripe_events) + len(paypal_events)
