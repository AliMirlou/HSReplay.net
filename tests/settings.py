from hsreplaynet.settings import *

SECRET_KEY = "hunter2"
DEBUG = True

DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"
INFLUX_ENABLED = False

STRIPE_TEST_PUBLIC_KEY = ""
STRIPE_TEST_SECRET_KEY = ""
STRIPE_PUBLIC_KEY = STRIPE_TEST_PUBLIC_KEY
STRIPE_SECRET_KEY = STRIPE_TEST_SECRET_KEY
STRIPE_LIVE_MODE = False

MONTHLY_PLAN_ID = "monthly-test-plan"
SEMIANNUAL_PLAN_ID = "semiannual-test-plan"

PREMIUM_OVERRIDE = False

STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"


REDSHIFT_DATABASE = {
	"ENGINE": "postgresql",
	"NAME": "test_hsredshift",
	"USER": "postgres",
	"PASSWORD": "",
	"HOST": "localhost",
	"PORT": 5432,
	"OPTIONS": {
		"sslmode": "disable",
	}
}

REDSHIFT_DATABASE["JDBC_URL"] = "jdbc:redshift://{host}:{port}/{db}".format(
	host=REDSHIFT_DATABASE["HOST"],
	port=REDSHIFT_DATABASE["PORT"],
	db=REDSHIFT_DATABASE["NAME"]
)


DATABASES = {
	"default": {
		"ENGINE": "django.db.backends.postgresql",
		"NAME": "hsreplaynet",
		"USER": "postgres",
		"PASSWORD": "",
		"HOST": "localhost",
		"PORT": "",
	},
	"uploads": {
		"ENGINE": "django.db.backends.postgresql",
		"NAME": "uploads",
		"USER": "postgres",
		"PASSWORD": "",
		"HOST": "localhost",
		"PORT": "",
	},
	"redshift": {
		"ENGINE": "django.db.backends.postgresql",
		"NAME": REDSHIFT_DATABASE["NAME"],
		"USER": REDSHIFT_DATABASE["USER"],
		"PASSWORD": REDSHIFT_DATABASE["PASSWORD"],
		"HOST": REDSHIFT_DATABASE["HOST"],
		"PORT": REDSHIFT_DATABASE["PORT"],
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
