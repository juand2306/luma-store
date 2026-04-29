from rest_framework import serializers
from .models import (
    Category, Product, ProductImage, ProductVariant, StockMovement
)


class CategorySerializer(serializers.ModelSerializer):
    subcategories = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id", "name", "description", "parent", "order",
            "is_active", "created_at", "subcategories"
        ]

    def get_subcategories(self, obj):
        children = obj.subcategories.filter(is_active=True)
        return CategorySerializer(children, many=True).data


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "product", "image", "order", "is_main"]
        extra_kwargs = {
            "product": {"required": False},
            "order":   {"required": False, "default": 0},
            "is_main": {"required": False, "default": False},
        }


class ProductVariantSerializer(serializers.ModelSerializer):
    effective_price = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            "id", "size", "color", "sku", "barcode",
            "price", "effective_price", "stock", "is_active"
        ]

    def get_effective_price(self, obj):
        return str(obj.get_price())


class ProductVariantWriteSerializer(serializers.ModelSerializer):
    """Serializer de escritura — sku y barcode son auto-generados por el modelo."""
    class Meta:
        model = ProductVariant
        fields = ["id", "product", "size", "color", "price", "stock", "is_active"]
        extra_kwargs = {
            "product": {"required": True},
        }


class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    total_stock = serializers.SerializerMethodField()
    active_variants_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku_base", "description", "category", "category_name",
            "cost", "price", "margin", "is_visible", "is_featured",
            "status", "min_stock", "created_at", "updated_at",
            "variants", "images", "total_stock", "active_variants_count"
        ]

    def get_total_stock(self, obj):
        return sum(v.stock for v in obj.variants.filter(is_active=True))

    def get_active_variants_count(self, obj):
        return obj.variants.filter(is_active=True).count()


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer liviano para listados (sin variantes anidadas completas)."""
    category_name = serializers.CharField(source="category.name", read_only=True)
    total_stock = serializers.SerializerMethodField()
    active_variants_count = serializers.SerializerMethodField()
    main_image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku_base", "category", "category_name",
            "price", "cost", "margin", "min_stock",
            "status", "is_visible", "is_featured",
            "total_stock", "active_variants_count", "main_image",
            "created_at",
        ]

    def get_total_stock(self, obj):
        return sum(v.stock for v in obj.variants.filter(is_active=True))

    def get_active_variants_count(self, obj):
        return obj.variants.filter(is_active=True).count()

    def get_main_image(self, obj):
        img = obj.images.filter(is_main=True).first() or obj.images.first()
        if img and img.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(img.image.url)
        return None


class StockMovementSerializer(serializers.ModelSerializer):
    variant_display = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            "id", "variant", "variant_display", "type", "quantity",
            "note", "reference_id", "created_by", "created_by_name", "created_at"
        ]
        read_only_fields = ["created_by", "created_at"]

    def get_variant_display(self, obj):
        return str(obj.variant)

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        movement = super().create(validated_data)
        # Aplicar movimiento al stock
        variant = movement.variant
        variant.stock = max(0, variant.stock + movement.quantity)
        variant.save(update_fields=["stock"])
        # Auto-actualizar estado del producto
        product = variant.product
        has_stock = product.variants.filter(is_active=True, stock__gt=0).exists()
        if not has_stock and product.status != "out":
            Product.objects.filter(pk=product.pk).update(status="out")
        elif has_stock and product.status == "out":
            Product.objects.filter(pk=product.pk).update(status="active")
        return movement


# Serializers para el portal púблico
class PublicProductVariantSerializer(serializers.ModelSerializer):
    effective_price = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = ["id", "size", "color", "effective_price", "stock", "available", "is_active"]

    def get_effective_price(self, obj):
        return str(obj.get_price())

    def get_available(self, obj):
        return obj.is_active and obj.stock > 0


class PublicProductSerializer(serializers.ModelSerializer):
    """Solo variantes activas con stock > 0."""
    variants = serializers.SerializerMethodField()
    images   = ProductImageSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    total_stock   = serializers.SerializerMethodField()
    main_image    = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "description", "category", "category_name",
            "price", "is_featured", "variants", "images",
            "total_stock", "main_image",
        ]

    def get_variants(self, obj):
        """Solo devuelve variantes activas (incluye agotadas para mostrar la variante pero con stock=0)."""
        active = obj.variants.filter(is_active=True)
        return PublicProductVariantSerializer(active, many=True).data

    def get_total_stock(self, obj):
        return sum(v.stock for v in obj.variants.filter(is_active=True))

    def get_main_image(self, obj):
        img = obj.images.filter(is_main=True).first() or obj.images.first()
        if img and img.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(img.image.url)
        return None
