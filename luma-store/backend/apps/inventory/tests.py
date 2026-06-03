from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User
from .models import Category, Product, ProductVariant, StockMovement


# ── Helpers ────────────────────────────────────────────────────────────────────

def _auth(client, user):
    """Attach a valid JWT Bearer token to the test client for the given user."""
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")


def make_owner(username="owner", password="pass1234"):
    return User.objects.create_user(username=username, password=password, role="owner")


def make_product(name="Camiseta", price=50000, cost=20000, status="active", **kwargs):
    return Product.objects.create(name=name, price=price, cost=cost, status=status, **kwargs)


def make_variant(product, size="M", color="Negro", stock=10, **kwargs):
    return ProductVariant.objects.create(
        product=product, size=size, color=color, stock=stock, **kwargs
    )


# ── Category Tests ─────────────────────────────────────────────────────────────

class CategoryTests(APITestCase):
    def setUp(self):
        self.user = make_owner()
        _auth(self.client, self.user)
        self.list_url   = "/api/v1/inventory/categories/"
        self.detail_url = lambda pk: f"/api/v1/inventory/categories/{pk}/"

    def test_create_category_returns_201_with_id_and_name(self):
        payload = {"name": "Ropa", "order": 1}
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", response.data)
        self.assertEqual(response.data["name"], "Ropa")

    def test_list_returns_only_root_active_categories(self):
        root = Category.objects.create(name="Raíz", order=0)
        child = Category.objects.create(name="Hijo", parent=root, order=1)
        inactive = Category.objects.create(name="Inactiva", is_active=False)

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        names = [c["name"] for c in response.data]
        self.assertIn("Raíz", names)
        # Child categories must NOT appear at root level
        self.assertNotIn("Hijo", names)
        # Inactive categories must NOT appear
        self.assertNotIn("Inactiva", names)

    def test_soft_delete_category_with_no_active_products_returns_200(self):
        category = Category.objects.create(name="Sin Productos")
        response = self.client.delete(self.detail_url(category.pk))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        category.refresh_from_db()
        self.assertFalse(category.is_active)

    def test_soft_delete_category_with_active_products_returns_400(self):
        category = Category.objects.create(name="Con Productos")
        Product.objects.create(
            name="Producto Activo", price=10000, cost=5000,
            status="active", category=category
        )
        response = self.client.delete(self.detail_url(category.pk))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Verify category is still active
        category.refresh_from_db()
        self.assertTrue(category.is_active)


# ── Product Tests ──────────────────────────────────────────────────────────────

class ProductTests(APITestCase):
    def setUp(self):
        self.user = make_owner()
        _auth(self.client, self.user)
        self.list_url   = "/api/v1/inventory/products/"
        self.stats_url  = "/api/v1/inventory/products/stats/"
        self.detail_url = lambda pk: f"/api/v1/inventory/products/{pk}/"

    def test_create_product_returns_201_with_auto_sku_and_margin(self):
        payload = {"name": "Pantalón", "price": 50000, "cost": 20000}
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # sku_base must be auto-generated, 8 chars, uppercase
        sku = response.data.get("sku_base", "")
        self.assertIsNotNone(sku)
        self.assertEqual(len(sku), 8)
        self.assertEqual(sku, sku.upper())

        # margin = ((50000 - 20000) / 50000) * 100 = 60.0
        margin = float(response.data.get("margin", 0))
        self.assertAlmostEqual(margin, 60.0, places=1)

    def test_list_products_returns_200_with_expected_fields(self):
        make_product()
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Support both paginated and non-paginated responses
        results = response.data.get("results", response.data)
        self.assertGreater(len(results), 0)
        first = results[0]
        self.assertIn("total_stock", first)
        self.assertIn("main_image", first)

    def test_stats_returns_200_with_required_keys(self):
        make_product()
        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for key in ("total", "out_of_stock", "low_stock", "total_value"):
            self.assertIn(key, response.data)

    def test_low_stock_filter_includes_products_at_or_below_min_stock(self):
        # Product with stock <= min_stock should appear
        low = make_product(name="Bajo Stock", min_stock=5)
        make_variant(low, stock=3)  # 3 <= 5 → low stock

        # Product with stock > min_stock should NOT appear
        high = make_product(name="Stock Suficiente", min_stock=5)
        make_variant(high, stock=10)  # 10 > 5 → not low stock

        # Product with stock = 0 should NOT appear (filter: stock__gt=0)
        zero = make_product(name="Sin Stock", min_stock=5)
        make_variant(zero, stock=0)

        response = self.client.get(self.list_url + "?low_stock=true")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data.get("results", response.data)
        names = [p["name"] for p in results]
        self.assertIn("Bajo Stock", names)
        self.assertNotIn("Stock Suficiente", names)
        self.assertNotIn("Sin Stock", names)


# ── ProductVariant Tests ───────────────────────────────────────────────────────

class ProductVariantTests(APITestCase):
    def setUp(self):
        self.user = make_owner()
        _auth(self.client, self.user)
        self.product = make_product(name="Chaqueta", price=80000, cost=40000)
        self.list_url = "/api/v1/inventory/variants/"

    def test_create_variant_without_price_uses_product_price(self):
        payload = {
            "product": self.product.pk,
            "size": "L",
            "color": "Azul",
            "stock": 5,
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        effective_price = float(response.data.get("effective_price", 0))
        self.assertAlmostEqual(effective_price, float(self.product.price), places=2)

    def test_create_variant_with_explicit_price_uses_variant_price(self):
        payload = {
            "product": self.product.pk,
            "size": "S",
            "color": "Rojo",
            "stock": 3,
            "price": 70000,
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        effective_price = float(response.data.get("effective_price", 0))
        self.assertAlmostEqual(effective_price, 70000.0, places=2)

    def test_sku_is_auto_generated_on_create(self):
        payload = {
            "product": self.product.pk,
            "size": "XL",
            "color": "Verde",
            "stock": 8,
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        sku = response.data.get("sku", "")
        self.assertTrue(len(sku) > 0, "SKU should be auto-generated and non-empty")


# ── StockMovement Tests ────────────────────────────────────────────────────────

class StockMovementTests(APITestCase):
    def setUp(self):
        self.user = make_owner()
        _auth(self.client, self.user)
        self.product = make_product(name="Sudadera", price=60000, cost=25000, status="active")
        self.variant = make_variant(self.product, stock=10)
        self.list_url = "/api/v1/inventory/movements/"

    def test_entry_movement_increases_stock(self):
        payload = {
            "variant": self.variant.pk,
            "type": "entry",
            "quantity": 5,
            "note": "Reposición",
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 15)

    def test_sale_movement_decreases_stock(self):
        payload = {
            "variant": self.variant.pk,
            "type": "sale",
            "quantity": -3,
            "note": "Venta #101",
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 7)

    def test_stock_reaching_zero_sets_product_status_to_out(self):
        # Drain stock to zero with a single movement
        payload = {
            "variant": self.variant.pk,
            "type": "sale",
            "quantity": -10,
            "note": "Agotar stock",
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 0)

        self.product.refresh_from_db()
        self.assertEqual(self.product.status, Product.Status.OUT)

    def test_return_movement_restores_stock_and_sets_product_active(self):
        # First drain the stock
        self.variant.stock = 0
        self.variant.save(update_fields=["stock"])
        Product.objects.filter(pk=self.product.pk).update(status="out")

        # Then apply a return movement to restore stock
        payload = {
            "variant": self.variant.pk,
            "type": "return",
            "quantity": 4,
            "note": "Devolución cliente",
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 4)

        self.product.refresh_from_db()
        self.assertEqual(self.product.status, Product.Status.ACTIVE)

    def test_stock_movement_records_created_by_authenticated_user(self):
        payload = {
            "variant": self.variant.pk,
            "type": "adjust",
            "quantity": 2,
            "note": "Ajuste manual",
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        movement_id = response.data["id"]
        movement = StockMovement.objects.get(pk=movement_id)
        self.assertEqual(movement.created_by, self.user)


# ── Public Catalog Tests ───────────────────────────────────────────────────────

class PublicCatalogTests(APITestCase):
    def setUp(self):
        # No authentication — public endpoints
        self.products_url   = "/api/v1/store/products/"
        self.categories_url = "/api/v1/store/categories/"

    def test_public_products_requires_no_auth(self):
        response = self.client.get(self.products_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_only_visible_products_appear_in_public_catalog(self):
        visible = Product.objects.create(
            name="Visible", price=30000, cost=10000,
            is_visible=True, status="active"
        )
        invisible = Product.objects.create(
            name="Invisible", price=30000, cost=10000,
            is_visible=False, status="active"
        )

        response = self.client.get(self.products_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data.get("results", response.data)
        names = [p["name"] for p in results]
        self.assertIn("Visible", names)
        self.assertNotIn("Invisible", names)

    def test_invisible_product_does_not_appear_in_public_catalog(self):
        Product.objects.create(
            name="Oculto", price=45000, cost=15000,
            is_visible=False, status="active"
        )
        response = self.client.get(self.products_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data.get("results", response.data)
        names = [p["name"] for p in results]
        self.assertNotIn("Oculto", names)

    def test_public_categories_requires_no_auth(self):
        # Need a category linked to a visible product to appear
        category = Category.objects.create(name="Categoría Pública")
        Product.objects.create(
            name="Producto Visible", price=20000, cost=8000,
            is_visible=True, status="active", category=category
        )

        response = self.client.get(self.categories_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
