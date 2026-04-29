import uuid
from django.db import models


class Category(models.Model):
    name        = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    parent      = models.ForeignKey(
        "self", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="subcategories"
    )
    order       = models.PositiveIntegerField(default=0)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    class Status(models.TextChoices):
        ACTIVE   = "active",   "Activo"
        INACTIVE = "inactive", "Inactivo"
        OUT      = "out",      "Agotado"

    name        = models.CharField(max_length=200)
    sku_base    = models.CharField(max_length=50, unique=True, blank=True)
    description = models.TextField(blank=True)
    category    = models.ForeignKey(
        Category, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="products"
    )
    cost        = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    price       = models.DecimalField(max_digits=12, decimal_places=2)
    margin      = models.DecimalField(max_digits=7, decimal_places=2, default=0)  # Porcentaje: 0-100.00
    is_visible  = models.BooleanField(default=False)   # Visible en portal
    is_featured = models.BooleanField(default=False)   # Destacado en portal
    status      = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    min_stock   = models.PositiveIntegerField(default=3)  # Umbral de alerta
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Auto-generar SKU base si está vacío
        if not self.sku_base:
            self.sku_base = str(uuid.uuid4())[:8].upper()
        # Recalcular margen automáticamente: ((precio - costo) / precio) * 100
        # Se guarda como porcentaje entero/decimal, ej: 35.50 para 35.5%
        try:
            price = float(self.price) if self.price else 0
            cost  = float(self.cost)  if self.cost  else 0
            if price > 0:
                self.margin = round(((price - cost) / price) * 100, 2)
            else:
                self.margin = 0
        except (TypeError, ValueError, ZeroDivisionError):
            self.margin = 0
        super().save(*args, **kwargs)


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image   = models.ImageField(upload_to="products/")
    order   = models.PositiveIntegerField(default=0)
    is_main = models.BooleanField(default=False)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"Imagen de {self.product.name} (orden {self.order})"


class ProductVariant(models.Model):
    product   = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    size      = models.CharField(max_length=20, blank=True)   # Talla: XS, S, M, L, XL, etc.
    color     = models.CharField(max_length=50, blank=True)   # Color: Negro, Blanco, etc.
    sku       = models.CharField(max_length=80, unique=True)
    barcode   = models.CharField(max_length=100, blank=True)
    price     = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Si es null, usa el precio base del producto"
    )
    stock     = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.product.name} — {self.size} {self.color}".strip()

    def get_price(self):
        return self.price if self.price is not None else self.product.price

    def save(self, *args, **kwargs):
        if not self.sku:
            self.sku = f"{self.product.sku_base}-{self.size}-{self.color}".upper()
        if not self.barcode:
            self.barcode = str(uuid.uuid4().int)[:12]
        super().save(*args, **kwargs)


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        ENTRY    = "entry",    "Entrada"
        SALE     = "sale",     "Venta"
        RETURN   = "return",   "Devolución"
        SWAP_IN  = "swap_in",  "Cambio — Entrada"
        SWAP_OUT = "swap_out", "Cambio — Salida"
        ADJUST   = "adjust",   "Ajuste manual"

    variant      = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, related_name="movements")
    type         = models.CharField(max_length=10, choices=MovementType.choices)
    quantity     = models.IntegerField()   # Positivo o negativo según tipo
    note         = models.TextField(blank=True)
    reference_id = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="ID de la venta, pedido o cambio relacionado"
    )
    created_by   = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_type_display()} — {self.variant} ({self.quantity})"
