from rest_framework.routers import DefaultRouter
from .views import SaleViewSet, ReturnViewSet

router = DefaultRouter()
router.register(r"returns", ReturnViewSet, basename="returns")
router.register(r"", SaleViewSet, basename="sales")

urlpatterns = router.urls
