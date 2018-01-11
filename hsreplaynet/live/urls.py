from django.conf.urls import url

from . import views


urlpatterns = [
	url(
		r"^distributions/player_class/(?P<game_type_name>\w+)/$",
		views.fetch_player_class_distribution,
		name="live_fetch_player_class_distribution"
	),
	url(
		r"^distributions/played_cards/$",
		views.fetch_played_cards_distribution,
		name="live_fetch_played_cards_distribution"
	),
	url(
		r"^distributions/played_cards/(?P<game_type_name>\w+)/$",
		views.fetch_played_cards_distribution_for_gametype,
		name="live_fetch_played_cards_distribution_for_gametype"
	),
	url(
		r"^streaming-now/$",
		views.StreamingNowView.as_view(),
	)
]
