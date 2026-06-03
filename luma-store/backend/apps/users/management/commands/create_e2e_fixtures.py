"""
manage.py create_e2e_fixtures

Crea los datos mínimos y deterministas para el suite de pruebas E2E.
Es completamente idempotente: si los datos ya existen los deja intactos
(excepto el stock, que se restaura a 100 si está por debajo de 10).

Uso:
    python manage.py create_e2e_fixtures

Credenciales de prueba:
    Usuario:    e2e_admin
    Contraseña: e2e_luma_2024
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

# Credenciales del usuario de prueba (deben coincidir con e2e/helpers/auth.js)
E2E_USERNAME = "e2e_admin"
E2E_PASSWORD = "e2e_luma_2024"
E2E_EMAIL    = "e2e@luma.test"

# Producto de prueba (debe coincidir con los tests)
E2E_CATEGORY    = "E2E Test"
E2E_PRODUCT     = "Camiseta E2E"
E2E_SIZE        = "M"
E2E_COLOR       = "Azul"
E2E_STOCK_RESET = 100   # Stock mínimo garantizado antes de cada run


class Command(BaseCommand):
    help = (
        "Crea fixtures deterministas para el suite E2E. "
        "Idempotente: seguro correrlo múltiples veces."
    )

    def handle(self, *args, **options):
        self.stdout.write("\n-- Fixtures E2E --")
        self._create_admin_user()
        self._create_product()
        self._configure_store()
        self.stdout.write(self.style.SUCCESS("Fixtures listos. ¡Puedes correr los tests E2E!\n"))

    # ── Usuario administrador ─────────────────────────────────────────────────

    def _create_admin_user(self):
        user, created = User.objects.get_or_create(
            username=E2E_USERNAME,
            defaults={
                "email":      E2E_EMAIL,
                "first_name": "E2E",
                "last_name":  "Admin",
                "role":       "admin",
                "is_staff":   True,
            },
        )
        # Siempre actualiza la contraseña para que sea la esperada
        user.set_password(E2E_PASSWORD)
        user.save(update_fields=["password"])

        label = "creado" if created else "ya existe"
        self.stdout.write(f"  Usuario '{E2E_USERNAME}': {label}")
        self.stdout.write(f"  Contraseña: {E2E_PASSWORD}")

    # ── Producto de prueba ────────────────────────────────────────────────────

    def _create_product(self):
        from apps.inventory.models import Category, Product, ProductVariant

        cat, _ = Category.objects.get_or_create(name=E2E_CATEGORY)

        product, created = Product.objects.get_or_create(
            name=E2E_PRODUCT,
            defaults={
                "category":    cat,
                "price":       50_000,
                "is_visible":  True,
                "is_featured": True,
                "status":      "active",
                "description": "Producto de prueba para el suite E2E. No eliminar.",
            },
        )
        if not created and not product.is_visible:
            product.is_visible = True
            product.status     = "active"
            product.save(update_fields=["is_visible", "status"])

        variant, var_created = ProductVariant.objects.get_or_create(
            product=product,
            size=E2E_SIZE,
            color=E2E_COLOR,
            defaults={"stock": E2E_STOCK_RESET, "is_active": True},
        )
        # Garantizar stock suficiente para los tests
        if variant.stock < 10:
            variant.stock = E2E_STOCK_RESET
            variant.save(update_fields=["stock"])

        p_label = "creado" if created else "ya existe"
        v_label = "creada" if var_created else "ya existe"
        self.stdout.write(f"  Producto '{E2E_PRODUCT}' (ID {product.id}): {p_label}")
        self.stdout.write(f"  Variante {E2E_SIZE}/{E2E_COLOR} (ID {variant.id}): {v_label}")
        self.stdout.write(f"  Stock actual: {variant.stock}")

    # ── StoreConfig mínima ────────────────────────────────────────────────────

    def _configure_store(self):
        """Asegura que la tienda tenga configuración básica para los tests."""
        from apps.users.models import StoreConfig
        config = StoreConfig.get_config()
        needs_save = False

        if not config.name or config.name == "Mi Tienda":
            config.name = "LUMA E2E Store"
            needs_save  = True

        if needs_save:
            config.save()
            self.stdout.write("  StoreConfig: actualizada")
        else:
            self.stdout.write(f"  StoreConfig: '{config.name}' (ok)")
