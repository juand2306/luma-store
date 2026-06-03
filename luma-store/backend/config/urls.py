from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static

# URLs del Portal de Clientes (públicas, sin autenticación)
from apps.inventory.views import PublicProductListView, PublicCategoryListView
from apps.orders.views import StoreOrderCreateView
from apps.users.views import PublicStoreConfigView
from rest_framework.routers import DefaultRouter

store_router = DefaultRouter()
store_router.register(r"products", PublicProductListView, basename="store-products")
store_router.register(r"categories", PublicCategoryListView, basename="store-categories")

urlpatterns = [
    # Django Admin
    path("admin/", admin.site.urls),

    # ── API Privada (requiere autenticación JWT) ──────────────────────────
    path("api/v1/auth/",      include("apps.users.urls")),
    path("api/v1/inventory/", include("apps.inventory.urls")),
    path("api/v1/sales/",     include("apps.sales.urls")),
    path("api/v1/orders/",    include("apps.orders.urls")),
    path("api/v1/customers/", include("apps.customers.urls")),
    path("api/v1/cash/",      include("apps.cash.urls")),
    path("api/v1/reports/",   include("apps.reports.urls")),
    path("api/v1/config/",    include("apps.users.config_urls")),

    # ── API Pública (portal de clientes, sin autenticación) ───────────────
    path("api/v1/store/orders/",     StoreOrderCreateView.as_view(), name="store-order-create"),
    path("api/v1/store/config/",     PublicStoreConfigView.as_view(), name="store-config-public"),
    path("api/v1/store/",            include(store_router.urls)),

    # ── Pasarela de pagos (webhook público — proveedor llama directamente) ─
    path("api/v1/payments/",         include("apps.payments.urls")),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
