import hashlib
import json
import os
import string
import time

from django.conf import settings
from django.contrib.postgres.fields import ArrayField, JSONField
from django.db import connection, models, transaction
from django.dispatch.dispatcher import receiver
from django.urls import reverse
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.safestring import mark_safe
from django.utils.text import slugify
from django.utils.timezone import now
from django_hearthstone.cards.models import Card
from django_intenum import IntEnumField
from hearthstone import deckstrings, enums
from hsarchetypes import classify_deck
from hsarchetypes.clustering import ClassClusters, Cluster, ClusterSet, create_cluster_set
from shortuuid.main import int_to_string, string_to_int

from hsreplaynet.utils.aws import s3_object_exists
from hsreplaynet.utils.aws.clients import FIREHOSE, LAMBDA, S3
from hsreplaynet.utils.aws.redshift import get_redshift_query
from hsreplaynet.utils.cards import card_db
from hsreplaynet.utils.db import dictfetchall
from hsreplaynet.utils.influx import influx_metric, influx_timer


ALPHABET = string.ascii_letters + string.digits


class DeckManager(models.Manager):
	def get_or_create_from_id_list(
		self,
		id_list,
		hero_id=None,
		game_type=None,
		classify_archetype=False
	):
		deck, created = self._get_or_create_deck_from_db(id_list)

		archetypes_enabled = settings.ARCHETYPE_CLASSIFICATION_ENABLED
		archetype_missing = deck.archetype_id is None
		full_deck = deck.size == 30
		if archetypes_enabled and classify_archetype and archetype_missing and full_deck:
			player_class = self._convert_hero_id_to_player_class(hero_id)
			self.classify_deck_with_archetype(deck, player_class, deck.format)

		return deck, created

	def _get_or_create_deck_from_db(self, id_list):
		if not id_list:
			# Empty list; not supported by our db function
			digest = generate_digest_from_deck_list(id_list)
			return Deck.objects.get_or_create(digest=digest)

		# This native implementation in the DB is to reduce the volume
		# of DB chatter between Lambdas and the DB
		cursor = connection.cursor()
		cursor.callproc("get_or_create_deck", (id_list, ))
		result_row = cursor.fetchone()
		deck_id = int(result_row[0])
		created_ts, digest, created, deck_size = result_row[1:]
		cursor.close()
		d = Deck.objects.get(id=deck_id)
		return d, created

	def _convert_hero_id_to_player_class(self, hero_id):
		if isinstance(hero_id, int):
			return Card.objects.get(dbf_id=hero_id).card_class
		elif hero_id:
			return Card.objects.get(card_id=hero_id).card_class
		return enums.CardClass.INVALID

	def classify_deck_with_archetype(self, deck, player_class, game_format):
		if game_format not in (enums.FormatType.FT_STANDARD, enums.FormatType.FT_WILD):
			return

		signature_weights = ClusterSnapshot.objects.get_signature_weights(
			game_format,
			player_class
		)

		sig_archetype_id = classify_deck(
			deck.dbf_map(), signature_weights
		)

		# New Style Deck Prediction
		nn_archetype_id = ClusterSetSnapshot.objects.predict_archetype_id(
			player_class,
			game_format,
			deck,
		)

		archetype_id = sig_archetype_id or nn_archetype_id
		influx_metric(
			"archetype_prediction_outcome",
			{
				"count": 1,
				"signature_weight_archetype_id": sig_archetype_id,
				"neural_net_archetype_id": nn_archetype_id,
				"archetype_id": archetype_id,
				"deck_id": deck.id,
			},
			success=archetype_id is not None,
			signature_weight_success=sig_archetype_id is not None,
			neural_net_success=nn_archetype_id is not None,
			method_agreement=sig_archetype_id == nn_archetype_id,
			player_class=player_class.name,
			game_format=game_format.name
		)
		if archetype_id:
			deck.update_archetype(archetype_id)

	def get_by_shortid(self, shortid):
		try:
			id = string_to_int(shortid, ALPHABET)
		except ValueError:
			raise Deck.DoesNotExist("Invalid deck ID")
		digest = hex(id)[2:].rjust(32, "0")
		return Deck.objects.get(digest=digest)


def generate_digest_from_deck_list(id_list):
	sorted_cards = sorted(id_list)
	m = hashlib.md5()
	m.update(",".join(sorted_cards).encode("utf-8"))
	return m.hexdigest()


class Deck(models.Model):
	"""
	Represents an abstract collection of cards.

	The default sorting for cards when iterating over a deck is by
	mana cost and then alphabetical within cards of equal cost.
	"""

	id = models.BigAutoField(primary_key=True)
	objects = DeckManager()
	cards = models.ManyToManyField(Card, through="Include")
	digest = models.CharField(max_length=32, unique=True)
	created = models.DateTimeField(auto_now_add=True, null=True, blank=True)
	archetype = models.ForeignKey(
		"decks.Archetype", on_delete=models.SET_NULL, blank=True, null=True
	)
	size = models.IntegerField(null=True)
	guessed_full_deck = models.ForeignKey(
		"decks.Deck", on_delete=models.PROTECT, null=True, blank=True
	)

	class Meta:
		db_table = "cards_deck"

	def __str__(self):
		if self.deck_class:
			return "%s Deck" % (self.deck_class.name.capitalize())
		return "Neutral Deck"

	def __repr__(self):
		values = self.includes.values("card__name", "count", "card__cost")
		alpha_sorted = sorted(values, key=lambda t: t["card__name"])
		mana_sorted = sorted(alpha_sorted, key=lambda t: t["card__cost"])
		value_map = ["%s x %i" % (c["card__name"], c["count"]) for c in mana_sorted]
		return "[%s]" % (", ".join(value_map))

	def __iter__(self):
		# sorted() is stable, so sort alphabetically first and then by mana cost
		alpha_sorted = sorted(self.cards.all(), key=lambda c: c.name)
		mana_sorted = sorted(alpha_sorted, key=lambda c: c.cost)
		return mana_sorted.__iter__()

	@cached_property
	def hero(self):
		deck_class = self.deck_class
		if deck_class and deck_class != enums.CardClass.NEUTRAL:
			return deck_class.default_hero

	@property
	def hero_dbf_id(self):
		return Card.objects.get(card_id=self.hero).dbf_id

	@cached_property
	def deck_class(self):
		for val in self.includes.values("card__card_class"):
			card_class = val["card__card_class"]
			if card_class not in (enums.CardClass.INVALID, enums.CardClass.NEUTRAL):
				return card_class
		return enums.CardClass.INVALID

	@cached_property
	def deckstring(self):
		cardlist = self.card_dbf_id_list()
		sorted_list = sorted(set(cardlist))
		cards = [(id, cardlist.count(id)) for id in sorted_list]
		return deckstrings.write_deckstring(cards, [self.hero_dbf_id], self.format)

	@cached_property
	def format(self):
		for val in self.includes.values("card__card_set"):
			card_set = val["card__card_set"]
			is_classic = card_set in (enums.CardSet.EXPERT1, enums.CardSet.CORE)
			if not is_classic and not card_set.is_standard:
				return enums.FormatType.FT_WILD
		return enums.FormatType.FT_STANDARD

	@property
	def shortid(self):
		return int_to_string(int(self.digest, 16), ALPHABET)

	@property
	def all_includes(self):
		"""
		Use instead of .includes if you know you will use all of them
		this will prefetch the related cards. (eg. in a deck list)
		"""
		fields = ("id", "count", "deck_id", "card__name")
		return self.includes.all().select_related("card").only(*fields)

	def get_absolute_url(self):
		return reverse("deck_detail", kwargs={"id": self.shortid})

	def update_archetype(self, archetype, save=True, force=True):
		"""
		Set the archetype field and save to the database,
		then call sync_archetype_to_firehose() to replicate the
		archetype update into Redshift.
		"""
		if isinstance(archetype, Archetype):
			archetype_id = archetype.id
		else:
			archetype_id = archetype
		if not force and self.archetype_id == archetype_id:
			return False
		self.archetype_id = archetype_id
		if save:
			self.save()
		self.sync_archetype_to_firehose()

		return True

	def sync_archetype_to_firehose(self):
		timestamp = now().replace(tzinfo=None)
		record = "{deck_id}|{archetype_id}|{as_of}\n".format(
			deck_id=str(self.id),
			archetype_id=str(self.archetype_id or ""),
			as_of=timestamp.isoformat(sep=" "),
		)

		result = FIREHOSE.put_record(
			DeliveryStreamName=settings.ARCHETYPE_FIREHOSE_STREAM_NAME,
			Record={
				"Data": record.encode("utf-8"),
			}
		)

		return result

	def card_dbf_id_list(self):
		result = []

		includes = self.includes.values_list("card__dbf_id", "count")
		for id, count in includes:
			for i in range(count):
				result.append(id)

		return result

	def dbf_map(self, transformer=int):
		includes = self.includes.values_list("card__dbf_id", "count")
		return {transformer(id): count for id, count in includes}

	def card_id_list(self):
		result = []

		includes = self.includes.values_list("card__card_id", "count")
		for id, count in includes:
			for i in range(count):
				result.append(id)

		return result

	def predicted_card_id_list(self):
		if self.guessed_full_deck and self.digest != self.guessed_full_deck.digest:
			return self.guessed_full_deck.card_id_list()

	def as_dbf_json(self, serialized=True):
		"""Serialize the deck list for storage in Redshift"""
		result = []
		for include in self.includes.all():
			result.append([include.card.dbf_id, include.count])

		if serialized:
			# separators=(",", ":") creates compact JSON encoding
			return json.dumps(result, separators=(",", ":"))
		else:
			return result


@receiver(models.signals.post_save, sender=Deck)
def update_deck_size_field(sender, instance, **kwargs):
	current_deck_size = sum(i.count for i in instance.includes.all())

	if instance.size != current_deck_size:
		instance.size = current_deck_size
		# Make sure to only save when updating to prevent recursion
		instance.save()


class Include(models.Model):
	id = models.BigAutoField(primary_key=True)
	deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name="includes")
	card = models.ForeignKey(Card, on_delete=models.PROTECT, related_name="included_in")
	count = models.IntegerField(default=1)

	class Meta:
		db_table = "cards_include"
		unique_together = ("deck", "card")

	def __str__(self):
		return "%s x %s" % (self.card.name, self.count)


class ArchetypeManager(models.Manager):

	def live(self):
		return self.filter(deleted=False)

	def _list_decks_from_redshift_for_format(self, game_format):
		query = get_redshift_query("list_decks_by_win_rate")
		if game_format == enums.FormatType.FT_STANDARD:
			paramiterized_query = query.build_full_params(dict(
				TimeRange="LAST_30_DAYS",
				GameType="RANKED_STANDARD",
			))
		else:
			paramiterized_query = query.build_full_params(dict(
				TimeRange="LAST_30_DAYS",
				GameType="RANKED_WILD",
			))

		return paramiterized_query.response_payload["series"]["data"]

	def _get_deck_archetype_map_from_redshift(self, game_format):
		data = self._list_decks_from_redshift_for_format(game_format)

		deck_archetype_map = {}
		for player_class, decks in data.items():
			for deck in decks:
				deck_archetype_map[deck["digest"]] = deck["archetype_id"]

		return deck_archetype_map

	def _get_deck_observation_counts_from_redshift(self, game_format):
		data = self._list_decks_from_redshift_for_format(game_format)
		observations = {}
		for player_class, decks in data.items():
			for deck in decks:
				observations[deck["digest"]] = deck["total_games"]

		return observations


class Archetype(models.Model):
	"""
	Archetypes cluster decks with minor card variations that all share the same strategy
	into a common group.

	E.g. 'Freeze Mage', 'Miracle Rogue', 'Pirate Warrior', 'Zoolock', 'Control Priest'
	"""

	id = models.BigAutoField(primary_key=True)
	objects = ArchetypeManager()
	name = models.CharField(max_length=250, blank=True)
	player_class = IntEnumField(enum=enums.CardClass, default=enums.CardClass.INVALID)
	deleted = models.BooleanField(default=False)

	class Meta:
		db_table = "cards_archetype"

	def __str__(self):
		return self.name

	@property
	def standard_cluster(self):
		return ClusterSnapshot.objects.get_live_cluster_for_archetype(
			enums.FormatType.FT_STANDARD,
			self
		)

	@property
	def wild_cluster(self):
		return ClusterSnapshot.objects.get_live_cluster_for_archetype(
			enums.FormatType.FT_WILD,
			self
		)

	@property
	def standard_signature(self):
		cluster = self.standard_cluster
		return {
			"as_of": cluster.class_cluster.cluster_set.as_of,
			"format": int(cluster.class_cluster.cluster_set.game_format),
			"components": [(int(dbf_id), weight) for dbf_id, weight in cluster.signature.items()],
		}

	@property
	def wild_signature(self):
		cluster = self.wild_cluster
		return {
			"as_of": cluster.class_cluster.cluster_set.as_of,
			"format": int(cluster.class_cluster.cluster_set.game_format),
			"components": [(int(dbf_id), weight) for dbf_id, weight in cluster.signature.items()],
		}

	@property
	def standard_signature_pretty(self):
		cluster = self.standard_cluster
		if cluster:
			return cluster.pretty_signature_string()
		return ""

	@property
	def wild_signature_pretty(self):
		cluster = self.wild_cluster
		if cluster:
			return cluster.pretty_signature_string()
		else:
			return ""

	@property
	def wild_signature_as_of(self):
		cluster = self.wild_cluster
		if cluster:
			return cluster.class_cluster.cluster_set.as_of
		else:
			return None

	@property
	def standard_signature_as_of(self):
		cluster = self.standard_cluster
		if cluster:
			return cluster.class_cluster.cluster_set.as_of
		else:
			return None

	def get_absolute_url(self):
		return reverse("archetype_detail", kwargs={"id": self.id, "slug": slugify(self.name)})


class ClusterSetManager(models.Manager):
	def snapshot(
		self,
		game_format=enums.FormatType.FT_STANDARD,
		num_clusters=20,
		merge_threshold=0.85,
		inherit_threshold=0.85,
		lookback=7,
		min_observations=100,
		experimental_threshold=1500,
		allow_inheritence_miss_list=[]
	):
		from hsreplaynet.analytics.processing import get_cluster_set_data

		data = get_cluster_set_data(
			game_format=game_format,
			lookback=lookback,
			min_observations=min_observations
		)

		with transaction.atomic():
			cs_snapshot = create_cluster_set(
				data,
				factory=ClusterSetSnapshot,
				num_clusters=num_clusters,
				merge_similarity=merge_threshold,
				consolidate=False,
				create_experimental_cluster=False
			)

			previous_snapshot = ClusterSetSnapshot.objects.filter(
				live_in_production=True
			).first()

			uninherited_id_set = cs_snapshot.inherit_from_previous(
				previous_snapshot,
				merge_threshold=inherit_threshold
			)

			if uninherited_id_set:
				for uninherited_id in uninherited_id_set:
					if uninherited_id not in allow_inheritence_miss_list:
						msg = "external id %i was not inherited"
						raise RuntimeError(msg % uninherited_id)

			cs_snapshot.consolidate_clusters(merge_threshold)
			cs_snapshot.create_experimental_clusters(
				experimental_cluster_threshold=experimental_threshold
			)

			ClusterSetSnapshot.objects.update(latest=False)
			cs_snapshot.game_format = game_format
			cs_snapshot.latest = True
			cs_snapshot.save()

			for class_cluster in cs_snapshot.class_clusters:
				class_cluster.cluster_set = cs_snapshot
				class_cluster.save()

				for cluster in class_cluster.clusters:
					cluster.class_cluster = class_cluster
					cluster.save()

		return cs_snapshot

	def predict_archetype_id(self, player_class, game_format, deck):
		class_cluster = ClassClusterSnapshot.objects.filter(
			player_class=player_class,
			cluster_set__live_in_production=True,
			cluster_set__game_format=game_format
		).first()
		if class_cluster:
			return class_cluster.predict_archetype_id(deck)
		else:
			return None


_TRAINING_DATA_CACHE = {}


class ClassClusterSnapshot(models.Model, ClassClusters):
	id = models.AutoField(primary_key=True)
	cluster_set = models.ForeignKey("ClusterSetSnapshot", on_delete=models.CASCADE)
	player_class = IntEnumField(enum=enums.CardClass, default=enums.CardClass.INVALID)

	def __str__(self):
		return ClassClusters.__str__(self)

	@property
	def clusters(self):
		if not hasattr(self, "_clusters"):
			self._clusters = list(self.clustersnapshot_set.all())
		return self._clusters

	@clusters.setter
	def clusters(self, clusters):
		self._clusters = clusters
		for cluster in clusters:
			cluster.class_cluster = self

	def _fetch_training_data(
		self,
		num_examples=1000000,
		max_dropped_cards=15,
		stratified=False,
		min_cards_for_determination=5
	):
		from hsarchetypes.features import to_neural_net_training_data
		key = (self.id, num_examples, max_dropped_cards, stratified, min_cards_for_determination)
		if key not in _TRAINING_DATA_CACHE:
			print("Constructing new training data: %s" % str(key))
			_TRAINING_DATA_CACHE[key] = to_neural_net_training_data(
				self,
				num_examples=num_examples,
				max_dropped_cards=max_dropped_cards,
				stratified=stratified,
				min_cards_for_determination=min_cards_for_determination
			)
		else:
			print("Serving data from cache: %s" % str(key))

		return _TRAINING_DATA_CACHE[key]

	def train_neural_network(
		self,
		num_examples=1000000,
		max_dropped_cards=15,
		stratified=False,
		min_cards_for_determination=5,
		batch_size=1000,
		num_epochs=20,
		base_layer_size=64,
		hidden_layer_size=64,
		num_hidden_layers=2,
		working_dir=None,
		upload_to_s3=False
	):
		from hsarchetypes.classification import train_neural_net
		from hsarchetypes.utils import plot_accuracy_graph, plot_loss_graph
		common_prefix_template = "%s_%i_%i_%s"
		values = (
			self.cluster_set.game_format.name,
			self.cluster_set.id,
			self.cluster_set.training_run_id,
			self.player_class.name,
		)
		common_prefix = common_prefix_template % values
		full_model_path = os.path.join(working_dir, common_prefix + "_model.h5")
		train_x, train_Y = self._fetch_training_data(
			num_examples=num_examples,
			max_dropped_cards=max_dropped_cards,
			stratified=stratified,
			min_cards_for_determination=min_cards_for_determination
		)
		print("Finished generating training data")
		history = train_neural_net(
			train_x,
			train_Y,
			full_model_path,
			batch_size=batch_size,
			num_epochs=num_epochs,
			base_layer_size=base_layer_size,
			hidden_layer_size=hidden_layer_size,
			num_hidden_layers=num_hidden_layers
		)
		accuracy = history.history["val_acc"][-1] * 100
		vals = (
			self.player_class.name,
			accuracy
		)
		print("%s accuracy: %.2f%%\n" % vals)

		loss_file_path = os.path.join(working_dir, common_prefix + "_loss.png")
		plot_loss_graph(history, self.player_class.name, loss_file_path)

		accuracy_file_path = os.path.join(working_dir, common_prefix + "_accuracy.png")
		plot_accuracy_graph(history, self.player_class.name, accuracy_file_path)

		if upload_to_s3:
			# The key structure for models in the bucket is as follows:
			# /models/<game_format>/<cluster_set_id>/<run_id>/<player_class>.h5
			# Which allows for easy listing of all the run_ids for a given snapshot

			# Within each run_id folder we expect:
			# A <player_class>.h5 file for each class
			# A summary.txt
			# A <player_class>_accuracy.png
			# A <player_class>_loss.png

			if os.path.exists(full_model_path):
				with open(full_model_path, "rb") as model:
					S3.put_object(
						Bucket=settings.KERAS_MODELS_BUCKET,
						Key=self.model_key,
						Body=model
					)

			if os.path.exists(loss_file_path):
				with open(loss_file_path, "rb") as model:
					S3.put_object(
						Bucket=settings.KERAS_MODELS_BUCKET,
						Key=self.loss_graph_key,
						Body=model
					)

			if os.path.exists(accuracy_file_path):
				with open(accuracy_file_path, "rb") as model:
					S3.put_object(
						Bucket=settings.KERAS_MODELS_BUCKET,
						Key=self.accuracy_graph_key,
						Body=model
					)

		return accuracy

	def predict_archetype_id(self, deck):
		event = self._to_prediction_event(deck)

		if settings.USE_ARCHETYPE_PREDICTION_LAMBDA or settings.ENV_AWS:
			with influx_timer("callout_to_predict_deck_archetype"):
				response = LAMBDA.invoke(
					FunctionName="predict_deck_archetype",
					InvocationType="RequestResponse",  # Synchronous invocation
					Payload=json.dumps(event),
				)
				if response["StatusCode"] == 200 and "FunctionError" not in response:
					result = json.loads(response["Payload"].read().decode("utf8"))
				else:
					raise RuntimeError(response["Payload"].read().decode("utf8"))
		else:
			from keras_handler import handler
			result = handler(event, None)

		predicted_class = result["predicted_class"]
		id_encoding = self.one_hot_external_ids(inverse=True)
		predicted_archetype_id = id_encoding[predicted_class]

		if predicted_archetype_id == -1:
			return None
		else:
			return predicted_archetype_id

	def _to_prediction_event(self, deck):
		from hsarchetypes.utils import to_prediction_vector_from_dbf_map
		prediction_vector = to_prediction_vector_from_dbf_map(deck.dbf_map())
		return {
			"model_bucket": settings.KERAS_MODELS_BUCKET,
			"model_key": self.model_key,
			"deck_vector": json.dumps(prediction_vector)
		}

	def neural_network_ready(self):
		return s3_object_exists(settings.KERAS_MODELS_BUCKET, self.model_key)

	@property
	def loss_graph_key(self):
		return self.common_key_prefix + "-loss.png"

	@property
	def accuracy_graph_key(self):
		return self.common_key_prefix + "-accuracy.png"

	@property
	def model_key(self):
		return self.common_key_prefix + ".h5"

	@property
	def common_key_prefix(self):
		return self.cluster_set.cluster_set_key_prefix + self.player_class.name


class ClusterManager(models.Manager):
	LIVE_SIGNATURES_QUERY = """
		SELECT
			c.external_id,
			c.ccp_signature
		FROM decks_clustersetsnapshot cs
		JOIN decks_classclustersnapshot ccs ON ccs.cluster_set_id = cs.id
		JOIN decks_clustersnapshot c ON c.class_cluster_id = ccs.id
		WHERE cs.live_in_production = True
		AND cs.game_format = %s
		AND ccs.player_class = %s
		AND c.external_id != -1;
	"""

	def get_signature_weights(self, game_format, player_class):
		with connection.cursor() as cursor:
			cursor.execute(
				self.LIVE_SIGNATURES_QUERY % (int(game_format), int(player_class))
			)
			result = {}
			for record in dictfetchall(cursor):
				if len(record["ccp_signature"]):
					if record["external_id"] not in result and record["external_id"]:
						result[record["external_id"]] = {}
					for dbf_id, weight in record["ccp_signature"].items():
						result[record["external_id"]][int(dbf_id)] = weight

			return result

	def get_live_cluster_for_archetype(self, game_format, archetype):
		return ClusterSnapshot.objects.filter(
			class_cluster__player_class=archetype.player_class,
			class_cluster__cluster_set__live_in_production=True,
			class_cluster__cluster_set__game_format=game_format,
			external_id=archetype.id
		).first()

	def get_live_signature_for_archetype(self, game_format, archetype, ccp_version=False):
		cluster = self.get_live_cluster_for_archetype(game_format, archetype)
		if not cluster:
			return None

		if ccp_version:
			return cluster.ccp_signature
		else:
			return cluster.signature


class ClusterSnapshot(models.Model, Cluster):
	id = models.AutoField(primary_key=True)
	objects = ClusterManager()
	class_cluster = models.ForeignKey(ClassClusterSnapshot, on_delete=models.CASCADE)
	cluster_id = models.IntegerField()
	experimental = models.BooleanField(default=False)
	signature = JSONField(default=dict)
	name = models.CharField(max_length=250, blank=True)
	rules = ArrayField(
		base_field=models.CharField(max_length=100, blank=True),
		default=list
	)
	data_points = JSONField(default=list)
	external_id = models.IntegerField(null=True, blank=True)
	ccp_signature = JSONField(default=dict)

	def __str__(self):
		return Cluster.__str__(self)

	@property
	def archetype(self):
		if self.external_id:
			return Archetype.objects.get(id=self.external_id)
		else:
			return None

	@property
	@mark_safe
	def pretty_signature_html(self):
		db = card_db()
		components = list(sorted(self.signature.items(), key=lambda t: t[1], reverse=True))
		table = "<table><tr><th>Card</th><th>Weight</th></tr>%s</table>"
		row = "<tr><td>%s</td><td>%s</td></tr>"
		rows = [row % (db[int(dbf)].name, round(weight, 4)) for dbf, weight in components]
		return table % "".join(rows)


class ClusterSetSnapshot(models.Model, ClusterSet):
	id = models.AutoField(primary_key=True)
	objects = ClusterSetManager()
	as_of = models.DateTimeField(default=timezone.now)
	game_format = IntEnumField(enum=enums.FormatType, default=enums.FormatType.FT_STANDARD)
	live_in_production = models.BooleanField(default=False)
	latest = models.BooleanField(default=False)
	training_run_id = models.IntegerField(null=True, blank=True)

	CLASS_CLUSTER_FACTORY = ClassClusterSnapshot
	CLUSTER_FACTORY = ClusterSnapshot

	class Meta:
		get_latest_by = "as_of"

	def __str__(self):
		return ClusterSet.__str__(self)

	@property
	def class_clusters(self):
		if not hasattr(self, "_class_clusters"):
			self._class_clusters = list(self.classclustersnapshot_set.all())
		return self._class_clusters

	@property
	def cluster_set_key_prefix(self):
		template = "models/{game_format}/{cluster_set_id}/{run_id}/"
		return template.format(
			game_format=self.game_format.name,
			cluster_set_id=self.id,
			run_id=self.training_run_id,
		)

	@class_clusters.setter
	def class_clusters(self, cc):
		self._class_clusters = cc
		for class_cluster in cc:
			class_cluster.cluster_set = self

	def update_all_signatures(self):
		for class_cluster in self.class_clusters:
			class_cluster.update_cluster_signatures()
			for cluster in class_cluster.clusters:
				cluster.save()

	def update_archetype_signatures(self, force=False):
		if force or all(c.neural_network_ready() for c in self.class_clusters):
			with transaction.atomic():
				ClusterSetSnapshot.objects.filter(
					live_in_production=True
				).update(live_in_production=False)
				self.live_in_production = True
				self.save()
		else:
			msg = "Cannot promote to live=True because the neural network is not ready"
			raise RuntimeError(msg)

	def train_neural_network(
		self,
		num_examples=1000000,
		max_dropped_cards=15,
		stratified=False,
		min_cards_for_determination=5,
		batch_size=1000,
		num_epochs=20,
		base_layer_size=64,
		hidden_layer_size=64,
		num_hidden_layers=2,
		working_dir=None,
		upload_to_s3=False,
		included_classes=None
	):
		start_ts = time.time()
		run_id = int(start_ts)
		self.training_run_id = run_id
		self.save()

		if working_dir:
			training_dir = working_dir
		else:
			training_dir = os.path.join(settings.BUILD_DIR, "models", str(run_id))

		if not os.path.exists(training_dir):
			os.mkdir(training_dir)

		summary_path = os.path.join(training_dir, "summary.txt")
		with open(summary_path, "w") as summary:
			summary.write("Game Format: %s\n" % self.game_format.name)
			summary.write("Cluster Set As Of: %s\n" % self.as_of.isoformat())
			summary.write("Training Run: %i\n\n" % run_id)

			summary.write("Num Examples: %i\n" % num_examples)
			summary.write("Max Dropped Cards: %i\n" % max_dropped_cards)
			summary.write("Stratified: %s\n" % str(stratified))
			summary.write("Min Cards For Determination: %i\n" % min_cards_for_determination)
			summary.write("Batch Size: %i\n" % batch_size)
			summary.write("Num Epochs: %i\n" % num_epochs)
			summary.write("Base Layer Size: %i\n" % base_layer_size)
			summary.write("Hidden Layer Size: %i\n" % hidden_layer_size)
			summary.write("Num Hidden Layers: %i\n\n" % num_hidden_layers)

			for class_cluster in self.class_clusters:
				player_class_name = class_cluster.player_class.name

				if included_classes and player_class_name not in included_classes:
					continue

				print("\nInitiating training for %s" % class_cluster.player_class.name)
				training_start = time.time()
				accuracy = class_cluster.train_neural_network(
					num_examples=num_examples,
					max_dropped_cards=max_dropped_cards,
					stratified=stratified,
					min_cards_for_determination=min_cards_for_determination,
					batch_size=batch_size,
					num_epochs=num_epochs,
					base_layer_size=base_layer_size,
					hidden_layer_size=hidden_layer_size,
					num_hidden_layers=num_hidden_layers,
					working_dir=training_dir,
					upload_to_s3=upload_to_s3
				)
				training_stop = time.time()
				duration = int(training_stop - training_start)
				print("Duration: %s seconds" % duration)
				print("Accuracy: %s" % round(accuracy, 4))

				summary.write("%s Duration: %i seconds\n" % (player_class_name, duration))
				summary.write("%s Accuracy: %s\n\n" % (player_class_name, round(accuracy, 4)))

			end_ts = time.time()
			full_duration = end_ts - start_ts
			duration_mins = int(full_duration / 60)
			duration_secs = int(full_duration % 60)
			summary.write("Full Duration: %i min(s) %i seconds\n" % (duration_mins, duration_secs))

		if upload_to_s3 and os.path.exists(summary_path):
			with open(summary_path, "rb") as summary:
				S3.put_object(
					Bucket=settings.KERAS_MODELS_BUCKET,
					Key=self.cluster_set_key_prefix + "summary.txt",
					Body=summary
				)
