from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, ProductViewSet,
    ProductVariantViewSet, StockMovementViewSet,
    ProductImageViewSet,
    PublicProductListView, PublicCategoryListView,
)

router = DefaultRouter()
router.register(r"categories",  CategoryViewSet,       basename="categories")
router.register(r"products",    ProductViewSet,        basename="products")
router.register(r"variants",    ProductVariantViewSet, basename="variants")
router.register(r"movements",   StockMovementViewSet,  basename="movements")
router.register(r"images",      ProductImageViewSet,   basename="images")

urlpatterns = router.urls

