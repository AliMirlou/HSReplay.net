import pytest
from rest_framework import status
from tests.games.test_processing import (  # noqa: F401
	disconnect_pre_save, twitch_vod_dynamodb_table, twitch_vod_game
)
from tests.utils import create_deck_from_deckstring, create_player, create_replay

from hsreplaynet.games.processing import record_twitch_vod

from .fixtures import (
	TEST_TWITCH_DECKSTRING_1, TEST_TWITCH_DECKSTRING_2, TEST_TWITCH_VOD_META
)


@pytest.mark.django_db  # noqa: F811
@pytest.mark.usefixtures("disconnect_pre_save", "twitch_vod_dynamodb_table")
def test_vod_list_view_by_deck_id(client, twitch_vod_game, user, mocker):
	mocker.patch.multiple(
		"hsreplaynet.api.views.vods.VodListView",
		authentication_classes=(),
		permission_classes=(),
	)

	deck1 = create_deck_from_deckstring(TEST_TWITCH_DECKSTRING_1, archetype_id=123)
	deck2 = create_deck_from_deckstring(TEST_TWITCH_DECKSTRING_2)

	create_player("Test Player 1", 1, deck1, twitch_vod_game, rank=24)
	create_player("Test Player 2", 2, deck2, twitch_vod_game, rank=25)

	replay = create_replay(user, twitch_vod_game)

	record_twitch_vod(replay, TEST_TWITCH_VOD_META)

	response = client.get(
		"/api/v1/vods/?deck_id=%s" % (deck1.shortid)
	)
	assert response.status_code == status.HTTP_200_OK, \
		"Got invalid response: %r" % response.data
	assert type(response.data) == list

	channel_name = TEST_TWITCH_VOD_META["twitch_vod"]["channel_name"]
	url = TEST_TWITCH_VOD_META["twitch_vod"]["url"]
	assert response.data == [{
		"channel_name": channel_name,
		"url": url,
		"rank": 24,
		"legend_rank": None,
		"friendly_player_archetype_id": 123,
		"opposing_player_archetype_id": None,
		"won": False,
		"game_length_seconds": 300,
	}]


@pytest.mark.django_db
@pytest.mark.usefixtures("disconnect_pre_save", "twitch_vod_dynamodb_table")
def test_vod_list_view_by_deck_id_empty(client, mocker):
	mocker.patch.multiple(
		"hsreplaynet.api.views.vods.VodListView",
		authentication_classes=(),
		permission_classes=(),
	)

	deck = create_deck_from_deckstring(TEST_TWITCH_DECKSTRING_1)

	response = client.get(
		"/api/v1/vods/?deck_id=%s" % (deck.shortid)
	)
	assert response.status_code == status.HTTP_200_OK, \
		"Got invalid response: %r" % response.data
	assert type(response.data) == list
	assert not len(response.data)