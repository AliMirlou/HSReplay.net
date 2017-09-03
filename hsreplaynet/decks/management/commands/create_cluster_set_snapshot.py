from django.core.management.base import BaseCommand
from hearthstone.enums import FormatType
from hsreplaynet.decks.models import ClusterSetSnapshot


class Command(BaseCommand):
	def add_arguments(self, parser):
		parser.add_argument("--num-clusters", default=50, type=int)
		parser.add_argument("--merge-threshold", default=0.75, type=float)
		parser.add_argument("--lookback", default=7, type=int)
		parser.add_argument("--min-observations", default=100, type=int)
		parser.add_argument("--experimental-threshold", default=1500, type=int)
		parser.add_argument("--allow-inheritence-miss", default="", type=str)

	def handle(self, *args, **options):
		for k, v in options.items():
			self.stdout.write("%s: %s" % (k, v))

		num_clusters = options["num_clusters"]
		merge_threshold = options["merge_threshold"]
		lookback = options["lookback"]
		min_observations = options["min_observations"]
		experimental_threshold = options["experimental_threshold"]
		inheritence_miss_tokens = options["allow_inheritence_miss"].split(",")
		allow_inheritence_miss = [s.strip() for s in inheritence_miss_tokens]

		ClusterSetSnapshot.objects.snapshot(
			FormatType.FT_STANDARD,
			num_clusters=num_clusters,
			merge_threshold=merge_threshold,
			lookback=lookback,
			min_observations=min_observations,
			experimental_threshold=experimental_threshold,
			allow_inheritence_miss_list=allow_inheritence_miss
		)
