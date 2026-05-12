from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, PurchaseOrderViewSet

router = DefaultRouter()
router.register(r"purchases", PurchaseOrderViewSet, basename="purchases")
router.register(r"", OrderViewSet, basename="orders")

urlpatterns = router.urls
