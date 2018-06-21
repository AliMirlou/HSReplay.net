# isort:skip_file
import os

from hsreplaynet.settings import *  # flake8: noqa

SECRET_KEY = "hunter2"
DEBUG = True

DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"
INFLUX_ENABLED = False

STRIPE_TEST_PUBLIC_KEY = "pk_test_foo"
STRIPE_TEST_SECRET_KEY = "sk_test_foo"
STRIPE_PUBLIC_KEY = STRIPE_TEST_PUBLIC_KEY
STRIPE_SECRET_KEY = STRIPE_TEST_SECRET_KEY
STRIPE_LIVE_MODE = False

MONTHLY_PLAN_ID = "monthly-test-plan"
SEMIANNUAL_PLAN_ID = "semiannual-test-plan"

PAYPAL_CLIENT_ID = "foo"
PAYPAL_CLIENT_SECRET = "bar"
PAYPAL_MONTHLY_PLAN_ID = ""
PAYPAL_SEMIANNUAL_PLAN_ID = ""
PAYPAL_MODE = "sandbox"

PREMIUM_OVERRIDE = False

STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"


REDSHIFT_DATABASE = {
	"ENGINE": "postgresql",
	"NAME": "test_hsredshift",
	"USER": "postgres",
	"PASSWORD": "",
	"HOST": os.environ.get("PGHOST", "localhost"),
	"PORT": 5432,
	"OPTIONS": {
		"sslmode": "disable",
	}
}


DATABASES = {
	"default": {
		"ENGINE": "django.db.backends.postgresql",
		"NAME": "test_hsreplaynet",
		"USER": os.environ.get("PGUSER", "postgres"),
		"PASSWORD": "",
		"HOST": os.environ.get("PGHOST", "localhost"),
		"PORT": os.environ.get("PGPORT", 5432),
		"TEST": {
			"NAME": "test_hsreplaynet"
		}
	},
	"uploads": {
		"ENGINE": "django.db.backends.postgresql",
		"NAME": "test_uploads",
		"USER": os.environ.get("PGUSER", "postgres"),
		"PASSWORD": "",
		"HOST": os.environ.get("PGHOST", "localhost"),
		"PORT": os.environ.get("PGPORT", 5432),
		"TEST": {
			"NAME": "test_uploads"
		}
	}
}


# Cache (django-redis-cache)
# https://django-redis-cache.readthedocs.io/en/latest/intro_quick_start.html
CACHES = {
	"default": {
		"BACKEND": "redis_lock.django_cache.RedisCache",
		"LOCATION": "localhost:6379",
		"OPTIONS": {
			"CLIENT_CLASS": "django_redis.client.DefaultClient",
		}
	},
	"redshift": {
		"BACKEND": "redis_lock.django_cache.RedisCache",
		"LOCATION": "localhost:6379",
		"OPTIONS": {
			"CLIENT_CLASS": "django_redis.client.DefaultClient",
			"COMPRESSOR": "django_redis.compressors.zlib.ZlibCompressor",
			"SERIALIZER": "django_redis.serializers.json.JSONSerializer",
		}
	}
}
additional_caches = (
	"redshift",
	"live_stats",
	"deck_prediction_primary",
	"deck_prediction_replica",
)

for c in additional_caches:
	CACHES[c] = CACHES["redshift"].copy()


JOUST_RAVEN_DSN_PUBLIC = ""
JOUST_RAVEN_ENVIRONMENT = ""

BOUNCY_VERIFY_CERTIFICATE = False
