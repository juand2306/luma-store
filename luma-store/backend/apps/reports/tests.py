from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.inventory.models import Category, Product, ProductVariant
from apps.sales.models import Sale, SaleItem
from apps.orders.models import Order, PurchaseOrder

User = get_user_model()


def _auth(client, user):
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")


def _make_user(username, role):
    return User.objects.create_user(username=username, password="pass", role=role)


def _make_product_and_variant(name="Camiseta", price=50000, stock=20):
    cat = Category.objects.first() or Category.objects.create(name="Ropa")
    product = Product.objects.create(name=name, price=price, cost=20000, category=cat)
    variant = ProductVariant.objects.create(product=product, size="M", color="Negro", stock=stock)
    return product, variant


def _make_sale(sold_by, variant, payment_method="cash", total=50000):
    """Helper: crea una venta directa (sin pedido de origen)."""
    sale = Sale.objects.create(
        number=f"VTA-T{Sale.objects.count():05d}",
        subtotal=total,
        total=total,
        payment_method=payment_method,
        sold_by=sold_by,
    )
    SaleItem.objects.create(
        sale=sale,
        variant=variant,
        quantity=1,
        unit_price=total,
        subtotal=total,
    )
    return sale


# ─────────────────────────────────────────────────────────────
#  DashboardView
# ─────────────────────────────────────────────────────────────

class DashboardTest(APITestCase):
    """GET /api/v1/reports/dashboard/"""

    URL = "/api/v1/reports/dashboard/"

    def setUp(self):
        self.admin = _make_user("admin_dash", "admin")
        self.viewer = _make_user("viewer_dash", "viewer")
        _auth(self.client, self.admin)

    def test_dashboard_returns_200(self):
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_dashboard_has_all_required_keys(self):
        resp = self.client.get(self.URL)
        required = [
            "today_revenue", "today_sales_count", "new_orders",
            "sales_chart", "orders_chart", "top_products",
            "stock_alerts", "pending_purchases",
        ]
        for key in required:
            self.assertIn(key, resp.data, f"Falta la clave '{key}' en el dashboard")

    def test_sales_chart_has_30_entries(self):
        resp = self.client.get(self.URL)
        self.assertEqual(len(resp.data["sales_chart"]), 30)

    def test_orders_chart_has_14_entries(self):
        resp = self.client.get(self.URL)
        self.assertEqual(len(resp.data["orders_chart"]), 14)

    def test_viewer_role_can_access_dashboard(self):
        _auth(self.client, self.viewer)
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_unauthenticated_returns_401(self):
        self.client.credentials()
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_pending_purchases_count_is_integer(self):
        resp = self.client.get(self.URL)
        self.assertIsInstance(resp.data["pending_purchases"], int)


# ─────────────────────────────────────────────────────────────
#  SalesReportView
# ─────────────────────────────────────────────────────────────

class SalesReportTest(APITestCase):
    """GET /api/v1/reports/sales/"""

    URL = "/api/v1/reports/sales/"

    def setUp(self):
        self.admin = _make_user("admin_srep", "admin")
        _auth(self.client, self.admin)

    def test_sales_report_returns_200(self):
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_sales_report_has_required_keys(self):
        resp = self.client.get(self.URL)
        for key in ["total_revenue", "total_sales", "sales_by_day", "payment_methods", "total_stock"]:
            self.assertIn(key, resp.data)

    def test_sales_by_day_has_30_entries_by_default(self):
        resp = self.client.get(self.URL)
        self.assertEqual(len(resp.data["sales_by_day"]), 30)

    def test_days_param_controls_sales_by_day_length(self):
        resp = self.client.get(f"{self.URL}?days=7")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["sales_by_day"]), 7)

    def test_total_revenue_is_numeric(self):
        resp = self.client.get(self.URL)
        self.assertIsInstance(resp.data["total_revenue"], (int, float))

    def test_unauthenticated_returns_401(self):
        self.client.credentials()
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ─────────────────────────────────────────────────────────────
#  ExportSalesView — regresión get_payment_method_display()
# ─────────────────────────────────────────────────────────────

class ExportSalesRegressionTest(APITestCase):
    """
    Regresión crítica: la exportación de ventas NO debe llamar
    get_payment_method_display() — ese método no existe en Sale porque
    payment_method no usa choices. El fix usa _payment_label() en su lugar.
    """

    EXPORT_URL = "/api/v1/reports/export/sales/"

    def setUp(self):
        self.admin = _make_user("admin_export", "admin")
        _auth(self.client, self.admin)
        _, self.variant = _make_product_and_variant()
        _make_sale(self.admin, self.variant, payment_method="cash", total=80000)
        _make_sale(self.admin, self.variant, payment_method="nequi", total=50000)

    def test_export_csv_returns_200_not_500(self):
        """La exportación CSV no debe lanzar AttributeError."""
        resp = self.client.get(f"{self.EXPORT_URL}?file_format=csv")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_export_csv_response_has_data_key(self):
        resp = self.client.get(f"{self.EXPORT_URL}?file_format=csv")
        self.assertIn("data", resp.data)
        self.assertTrue(len(resp.data["data"]) > 0)

    def test_export_csv_has_format_and_filename(self):
        resp = self.client.get(f"{self.EXPORT_URL}?file_format=csv")
        self.assertEqual(resp.data["format"], "csv")
        self.assertIn("ventas", resp.data["filename"])

    def test_export_xlsx_returns_200_if_openpyxl_installed(self):
        """Si openpyxl está instalado, la exportación xlsx no debe fallar."""
        try:
            import openpyxl  # noqa: F401
        except ImportError:
            self.skipTest("openpyxl no instalado — omitiendo test xlsx")
        resp = self.client.get(f"{self.EXPORT_URL}?file_format=xlsx")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("data", resp.data)

    def test_export_uses_payment_label_not_display(self):
        """Verifica que el CSV produzca etiquetas legibles (no clave raw)."""
        resp = self.client.get(f"{self.EXPORT_URL}?file_format=csv")
        import base64
        csv_content = base64.b64decode(resp.data["data"]).decode("utf-8")
        # "Efectivo" es la etiqueta de "cash" según _payment_label()
        self.assertIn("Efectivo", csv_content)


# ─────────────────────────────────────────────────────────────
#  InventoryReportView
# ─────────────────────────────────────────────────────────────

class InventoryReportTest(APITestCase):
    """GET /api/v1/reports/inventory/"""

    URL = "/api/v1/reports/inventory/"

    def setUp(self):
        self.admin = _make_user("admin_inv", "admin")
        _auth(self.client, self.admin)
        _make_product_and_variant(name="Camisa Inventario", stock=15)

    def test_inventory_report_returns_200(self):
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_inventory_report_has_required_keys(self):
        resp = self.client.get(self.URL)
        for key in ["total_products", "total_stock", "products"]:
            self.assertIn(key, resp.data)

    def test_products_list_is_a_list(self):
        resp = self.client.get(self.URL)
        self.assertIsInstance(resp.data["products"], list)

    def test_total_products_matches_db(self):
        resp = self.client.get(self.URL)
        # Solo cuenta productos activos/agotados — al menos el creado en setUp
        self.assertGreaterEqual(resp.data["total_products"], 1)

    def test_viewer_can_access_inventory_report(self):
        viewer = _make_user("viewer_inv", "viewer")
        _auth(self.client, viewer)
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────
#  ProductReportView
# ─────────────────────────────────────────────────────────────

class ProductReportTest(APITestCase):
    """GET /api/v1/reports/products/"""

    URL = "/api/v1/reports/products/"

    def setUp(self):
        self.admin = _make_user("admin_prod", "admin")
        _auth(self.client, self.admin)
        _, self.variant = _make_product_and_variant(name="Chaqueta Report", stock=10)
        _make_sale(self.admin, self.variant, total=100000)

    def test_product_report_returns_200(self):
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_product_report_has_required_keys(self):
        resp = self.client.get(self.URL)
        for key in ["top_by_revenue", "top_by_units", "by_category", "slow_movers"]:
            self.assertIn(key, resp.data)

    def test_top_by_revenue_is_list(self):
        resp = self.client.get(self.URL)
        self.assertIsInstance(resp.data["top_by_revenue"], list)

    def test_top_by_units_is_list(self):
        resp = self.client.get(self.URL)
        self.assertIsInstance(resp.data["top_by_units"], list)

    def test_days_param_is_reflected_in_response(self):
        resp = self.client.get(f"{self.URL}?days=7")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["days"], 7)

    def test_unauthenticated_returns_401(self):
        self.client.credentials()
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
