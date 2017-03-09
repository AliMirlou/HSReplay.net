from django.conf.urls import include, url
from rest_framework.routers import DefaultRouter
from hsreplaynet.comments.urls import api_urlpatterns as comments_urlpatterns
from hsreplaynet.packs.api import PackViewSet
from hsreplaynet.webhooks.api import WebhookViewSet
from . import views


router = DefaultRouter()
router.register(r"agents", views.APIKeyViewSet)
router.register(r"tokens", views.AuthTokenViewSet)
router.register(r"uploads", views.UploadEventViewSet)
router.register(r"packs", PackViewSet)
router.register(r"webhooks", WebhookViewSet)

urlpatterns = [
	url(r"^v1/", include(router.urls)),
	url(r"^v1/games/$", views.GameReplayList.as_view()),
	url(r"^v1/games/(?P<shortid>.+)/$", views.GameReplayDetail.as_view()),
	url(r"^v1/claim_account/", views.CreateAccountClaimView.as_view()),
	url(r"^api-auth/", include("rest_framework.urls", namespace="rest_framework")),
]

urlpatterns += comments_urlpatterns
