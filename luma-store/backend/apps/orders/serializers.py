from rest_framework import serializers
from .models import Order, OrderItem, OrderStatusHistory, PurchaseOrder
from apps.inventory.models import ProductVariant


# ── Compras ───────────────────────────────────────────────────────────────────

class PurchaseOrderSerializer(serializers.ModelSerializer):
    status_display   = serializers.SerializerMethodField()
    pending_qty      = serializers.SerializerMethodField()
    created_by_name  = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()
    current_stock    = serializers.SerializerMethodField()

    class Meta:
        model  = PurchaseOrder
        fields = [
            "id", "number",
            "variant", "product_name", "size", "color",
            "requested_qty", "received_qty", "pending_qty",
            "unit_cost", "note",
            "status", "status_display",
            "created_by", "created_by_name",
            "received_by", "received_by_name", "received_at",
            "current_stock",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "number", "received_qty", "status",
            "created_by", "received_by", "received_at",
            "created_at", "updated_at",
        ]

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_pending_qty(self, obj):
        return max(0, obj.requested_qty - obj.received_qty)

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None

    def get_received_by_name(self, obj):
        return obj.received_by.get_full_name() if obj.received_by else None

    def get_current_stock(self, obj):
        return obj.variant.stock if obj.variant_id else None


class PurchaseOrderUpdateSerializer(serializers.ModelSerializer):
    """Solo permite editar nota, costo y cantidad (si sigue pendiente)."""
    class Meta:
        model  = PurchaseOrder
        fields = ["note", "unit_cost", "requested_qty"]


class PurchaseReceiveSerializer(serializers.Serializer):
    qty_received   = serializers.IntegerField(min_value=1)
    payment_method = serializers.CharField(required=False, allow_blank=True, default="")
    note           = serializers.CharField(required=False, allow_blank=True, default="")


class OrderItemSerializer(serializers.ModelSerializer):
    variant_display = serializers.SerializerMethodField()
    product_name    = serializers.SerializerMethodField()
    size            = serializers.SerializerMethodField()
    color           = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id", "variant", "variant_display", "product_name",
            "size", "color",
            "quantity", "unit_price", "subtotal",
        ]

    def get_variant_display(self, obj):
        return str(obj.variant)

    def get_product_name(self, obj):
        return obj.variant.product.name

    def get_size(self, obj):
        return obj.variant.size or ""

    def get_color(self, obj):
        return obj.variant.color or ""


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
            "id", "number",
            "customer", "customer_name", "customer_phone", "note",
            "subtotal", "total", "status", "status_display",
            "attended_by", "attended_by_name",
            "payment_status", "payment_method",
            "sale_number", "sale_id",
            "created_at", "updated_at",
            "items", "history"
        ]
        read_only_fields = ["number", "customer", "created_at", "updated_at", "attended_by"]

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
        # Usa el prefetch cache en lugar de lanzar un COUNT extra por pedido
        return len(obj.items.all())

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
    items          = StoreOrderItemSerializer(many=True)
    customer_name  = serializers.CharField(max_length=150)
    customer_phone = serializers.CharField(max_length=20)
    # Email opcional: si se proporciona, el cliente recibirá confirmación y
    # actualizaciones de estado. Se almacena en el registro Customer.
    customer_email = serializers.EmailField(required=False, allow_blank=True, default="")
    note           = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_customer_phone(self, value):
        digits = "".join(c for c in value if c.isdigit())
        if len(digits) < 7:
            raise serializers.ValidationError("Ingresa un número de celular válido (mínimo 7 dígitos).")
        return value

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("El pedido debe tener al menos un ítem.")

        # Bulk-fetch todas las variantes en una sola query (evita N+1)
        variant_ids = [item["variant_id"] for item in items]
        variants_map = {
            v.id: v
            for v in ProductVariant.objects.filter(
                id__in=variant_ids
            ).select_related("product")
        }

        for item in items:
            vid = item["variant_id"]
            variant = variants_map.get(vid)
            if not variant:
                raise serializers.ValidationError(
                    f"El producto con variante ID {vid} no existe."
                )
            if variant.stock < item["quantity"]:
                raise serializers.ValidationError(
                    f"Stock insuficiente para {variant.product.name} "
                    f"talla {variant.size} color {variant.color}. "
                    f"Solo quedan {variant.stock} unidades."
                )
            if not variant.is_active:
                raise serializers.ValidationError(
                    f"La variante {variant.size}/{variant.color} de "
                    f"{variant.product.name} no está disponible."
                )
            if not variant.product.is_visible:
                raise serializers.ValidationError(
                    f"El producto {variant.product.name} no está disponible."
                )
        return items
