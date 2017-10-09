from django.core.cache import caches

from hsreplaynet.utils.redis import RedisPopularityDistribution


class PopularityWinrateDistribution:
	def __init__(self, redis, name, max_items=9, bucket_size=5, ttl=600):
		self.name = name
		self.max_items = max_items
		self.bucket_size = bucket_size
		self.observations = RedisPopularityDistribution(
			redis,
			name="%s_OBSERVATIONS" % self.name,
			namespace="POPULARITY",
			ttl=ttl,
			max_items=self.max_items,
			bucket_size=self.bucket_size
		)
		self.wins = RedisPopularityDistribution(
			redis,
			name="%s_WINS" % self.name,
			namespace="POPULARITY",
			ttl=ttl,
			max_items=self.max_items,
			bucket_size=self.bucket_size
		)

	def increment(self, key, win=False, as_of=None):
		self.observations.increment(key, as_of=as_of)
		if win:
			self.wins.increment(key, as_of=as_of)

	def distribution(self, start_ts, end_ts):
		games = self.observations.distribution(
			start_ts=start_ts,
			end_ts=end_ts,
		)
		wins = self.wins.distribution(
			start_ts=start_ts,
			end_ts=end_ts,
		)
		result = {}
		for key, val in games.items():
			result[key] = {
				"games": val,
				"wins": wins.get(key, 0)
			}
		return result


def get_player_class_distribution(game_type, redis_client=None, ttl=3200):
	if redis_client:
		redis = redis_client
	else:
		redis = caches["live_stats"].client.get_client()

	name = "PLAYER_CLASS_%s" % game_type
	return PopularityWinrateDistribution(redis, name=name, ttl=ttl)


def get_played_cards_distribution(game_type, redis_client=None, ttl=600):
	if redis_client:
		redis = redis_client
	else:
		redis = get_live_stats_redis()

	name = "PLAYED_CARDS_%s" % game_type
	return RedisPopularityDistribution(
		redis,
		name=name,
		namespace="POPULARITY",
		ttl=ttl,
		max_items=5000,
		bucket_size=5
	)


def get_live_stats_redis():
	return caches["live_stats"].client.get_client()
