from rest_framework.routers import DefaultRouter
from .views import CashSessionViewSet, CashMovementViewSet

router = DefaultRouter()
router.register(r"sessions", CashSessionViewSet, basename="cash-sessions")
router.register(r"movements", CashMovementViewSet, basename="cash-movements")

urlpatterns = router.urls
