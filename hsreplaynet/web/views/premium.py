import random

from django.conf import settings
from django_reflinks.models import ReferralLink
from shortuuid import ShortUUID

from . import SimpleReactView


class PremiumDetailView(SimpleReactView):
	title = "HSReplay.net Premium"
	description = (
		"More filters, more features, more data: Gain access to advanced "
		"Hearthstone statistics backed by millions of games with HSReplay.net Premium "
		"for HSReplay.net."
	)
	bundle = "premium_detail"

	quotes = [
		"It only cost my soul!",
		"Mind if I roll Need?",
		"I hope you like my invention!",
		"Who knows what secrets we'll uncover?",
		"You require my assistance?",
		"Don't worry love, the cavalry's here!",
		"Put your faith in the stats.",
		"The gates are open!",
		"Are you ready for this?",
		"Join, or die… or both!",
		"D-d-don't touch that!",
		"Wanna blow somethin' up?",
		"I have no time for games!",
		"Support a small indie company!",
		"Everyone, get in here!",
	]

	def get_react_context(self):
		ret = {
			"random_quote": random.choice(self.quotes),
			"featured_card": getattr(settings, "FEATURED_CARD_ID", ""),
			"featured_deck": getattr(settings, "FEATURED_DECK_ID", ""),
		}

		user = self.request.user
		if user.is_authenticated:
			reflink = ReferralLink.objects.filter(user=user).first()
			if not reflink:
				reflink = ReferralLink.objects.create(
					identifier=ShortUUID().uuid()[:6], user=user
				)
			if not reflink.disabled:
				ret["reflink"] = "https://hsreplay.net" + reflink.get_absolute_url()
				ret["discount"] = "$2.50 USD"

		return ret
