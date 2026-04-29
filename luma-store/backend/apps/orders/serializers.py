from rest_framework import serializers
from .models import Order, OrderItem, OrderStatusHistory
from apps.inventory.models import ProductVariant


class OrderItemSerializer(serializers.ModelSerializer):
    variant_display = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id", "variant", "variant_display", "product_name",
            "quantity", "unit_price", "subtotal"
        ]

    def get_variant_display(self, obj):
        return str(obj.variant)

    def get_product_name(self, obj):
        return obj.variant.product.name


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderStatusHistory
        fields = ["id", "status", "note", "changed_by", "changed_by_name", "created_at"]
        read_only_fields = ["changed_by", "created_at"]

    def get_changed_by_name(self, obj):
        return obj.changed_by.get_full_name() if obj.changed_by else None


class OrderSerializer(serializers.ModelSerializer):
    items           = OrderItemSerializer(many=True, read_only=True)
    history         = OrderStatusHistorySerializer(many=True, read_only=True)
    attended_by_name = serializers.SerializerMethodField()
    status_display  = serializers.SerializerMethodField()
    sale_number     = serializers.SerializerMethodField()
    sale_id         = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "number", "customer_name", "customer_phone", "note",
            "subtotal", "total", "status", "status_display",
            "attended_by", "attended_by_name",
            "payment_status", "payment_method",
            "sale_number", "sale_id",
            "created_at", "updated_at",
            "items", "history"
        ]
        read_only_fields = ["number", "created_at", "updated_at", "attended_by"]

    def get_attended_by_name(self, obj):
        return obj.attended_by.get_full_name() if obj.attended_by else None

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_sale_number(self, obj):
        try:
            return obj.sale.number
        except Exception:
            return None

    def get_sale_id(self, obj):
        try:
            return obj.sale.id
        except Exception:
            return None


class OrderListSerializer(serializers.ModelSerializer):
    """Serializer liviano para listado."""
    status_display = serializers.SerializerMethodField()
    item_count     = serializers.SerializerMethodField()
    sale_number    = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "number", "customer_name", "customer_phone",
            "total", "status", "status_display",
            "item_count", "sale_number", "created_at"
        ]

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_item_count(self, obj):
        return obj.items.count()

    def get_sale_number(self, obj):
        try:
            return obj.sale.number
        except Exception:
            return None


class OrderUpdateSerializer(serializers.ModelSerializer):
    """Solo permite cambiar el estado y al usuario que atiende."""
    class Meta:
        model = Order
        fields = ["status", "attended_by", "note"]


class StoreOrderItemSerializer(serializers.Serializer):
    """Ítem del pedido desde el portal (público)."""
    variant_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class StoreOrderCreateSerializer(serializers.Serializer):
    """Crear pedido desde el portal de clientes (sin autenticación)."""
    items = StoreOrderItemSerializer(many=True)
    customer_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    customer_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("El pedido debe tener al menos un ítem.")
        for item in items:
            try:
                variant = ProductVariant.objects.get(id=item["variant_id"])
            except ProductVariant.DoesNotExist:
                raise serializers.ValidationError(
                    f"El producto con variante ID {item['variant_id']} no existe."
                )
            if variant.stock < item["quantity"]:
                raise serializers.ValidationError(
                    f"Stock insuficiente para {variant.product.name} "
                    f"talla {variant.size} color {variant.color}. "
                    f"Solo quedan {variant.stock} unidades."
                )
            if not variant.product.is_visible:
                raise serializers.ValidationError(
                    f"El producto {variant.product.name} no está disponible."
                )
        return items
