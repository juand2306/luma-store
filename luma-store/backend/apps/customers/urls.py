from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, LoyaltyConfigView

router = DefaultRouter()
router.register(r"", CustomerViewSet, basename="customers")

urlpatterns = [
    path("loyalty/", LoyaltyConfigView.as_view(), name="loyalty-config"),
] + router.urls
