from rest_framework import serializers
from .models import Sale, SaleItem, Return
from apps.inventory.models import ProductVariant
from apps.inventory.serializers import ProductVariantSerializer


class SaleItemSerializer(serializers.ModelSerializer):
    variant_display = serializers.SerializerMethodField()

    class Meta:
        model = SaleItem
        fields = ["id", "variant", "variant_display", "quantity", "unit_price", "subtotal"]

    def get_variant_display(self, obj):
        return str(obj.variant)


class SaleItemWriteSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField(required=False, allow_null=True)
    product_id = serializers.IntegerField(required=False, allow_null=True)  # Fallback para productos sin variantes
    quantity   = serializers.IntegerField(min_value=1)

    def validate(self, data):
        if not data.get('variant_id') and not data.get('product_id'):
            raise serializers.ValidationError("Se requiere variant_id o product_id.")
        return data


class SaleSerializer(serializers.ModelSerializer):
    items          = SaleItemSerializer(many=True, read_only=True)
    sold_by_name   = serializers.SerializerMethodField()
    customer_name  = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    discount       = serializers.SerializerMethodField()
    payment_method_display = serializers.SerializerMethodField()
    order_number   = serializers.SerializerMethodField()
    order_id       = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id", "number",
            "order_id", "order_number",
            "customer", "customer_name", "customer_phone",
            "subtotal", "discount", "total",
            "points_used", "points_earned",
            "payment_method", "payment_method_display",
            "cash_received", "cash_change",
            "note", "sold_by", "sold_by_name", "cash_session",
            "created_at", "items"
        ]
        read_only_fields = ["number", "sold_by", "created_at"]

    def get_sold_by_name(self, obj):
        return obj.sold_by.get_full_name() if obj.sold_by else None

    def get_customer_name(self, obj):
        return obj.customer.name if obj.customer else None

    def get_customer_phone(self, obj):
        return obj.customer.phone if obj.customer else None

    def get_discount(self, obj):
        """Descuento aplicado = subtotal - total (por puntos canjeados)."""
        return float(obj.subtotal) - float(obj.total)

    def get_payment_method_display(self, obj):
        """Resuelve la etiqueta desde StoreConfig inyectado en el contexto
        (1 fetch por request, no N fetches por objeto de la lista)."""
        BASE = {
            "cash": "Efectivo", "transfer": "Transferencia",
            "debit": "Débito", "credit": "Crédito",
            "nequi": "Nequi", "daviplata": "Daviplata", "other": "Otro",
        }
        config = self.context.get("store_config")
        if config:
            for m in (config.payment_methods or []):
                if m.get("key") == obj.payment_method:
                    return m.get("label", obj.payment_method)
        return BASE.get(obj.payment_method, obj.payment_method)

    def get_order_number(self, obj):
        try:
            return obj.order.number if obj.order_id else None
        except Exception:
            return None

    def get_order_id(self, obj):
        return obj.order_id


class SaleCreateSerializer(serializers.Serializer):
    """Serializer para crear una venta con todos sus ítems y lógica de negocio."""
    items          = SaleItemWriteSerializer(many=True)
    payment_method = serializers.CharField()   # Acepta los valores del frontend (cash, transfer, card, nequi, daviplata)
    cash_received  = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    customer       = serializers.IntegerField(required=False, allow_null=True)
    note           = serializers.CharField(required=False, allow_blank=True, default="")
    points_used    = serializers.IntegerField(required=False, default=0)

    def validate_payment_method(self, value):
        """Valida el método de pago contra StoreConfig (métodos configurados)."""
        # Alias de compatibilidad para clientes que envíen claves antiguas
        ALIAS = {
            'card':    'debit',
            'mixed':   'other',
            'tarjeta': 'debit',
        }
        normalized = ALIAS.get(value, value)

        try:
            config  = StoreConfig.get_config()
            methods = config.payment_methods or []
            if methods:
                valid_keys = [m["key"] for m in methods]
                if normalized not in valid_keys:
                    raise serializers.ValidationError(
                        f"Método de pago inválido: '{value}'. "
                        f"Válidos: {', '.join(valid_keys)}"
                    )
                return normalized
        except serializers.ValidationError:
            raise
        except Exception:
            pass

        # Fallback: si no hay métodos configurados, usar los del sistema base
        base_valid = [c[0] for c in Sale.PaymentMethod.choices]
        if normalized not in base_valid:
            raise serializers.ValidationError(
                f"Método de pago inválido: '{value}'. "
                f"Válidos: {', '.join(base_valid)}"
            )
        return normalized

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Debe incluir al menos un ítem.")

        # Bulk-fetch todas las variantes nombradas en una sola query
        variant_ids = [i["variant_id"] for i in items if i.get("variant_id")]
        variants_map = {}
        if variant_ids:
            variants_map = {
                v.id: v
                for v in ProductVariant.objects.filter(id__in=variant_ids).select_related("product")
            }

        for item in items:
            vid = item.get('variant_id')
            pid = item.get('product_id')
            if vid:
                variant = variants_map.get(vid)
                if not variant:
                    raise serializers.ValidationError(f"Variante {vid} no existe.")
                if variant.stock < item['quantity']:
                    raise serializers.ValidationError(
                        f"Stock insuficiente para {variant.product.name}: disponible {variant.stock} ud."
                    )
            elif pid:
                from apps.inventory.models import Product
                try:
                    product = Product.objects.prefetch_related('variants').get(id=pid)
                except Product.DoesNotExist:
                    raise serializers.ValidationError(f"Producto {pid} no existe.")
                # Filtra en Python usando el prefetch cache — evita N+1
                total_stock = sum(v.stock for v in product.variants.all() if v.is_active)
                if total_stock < item['quantity']:
                    raise serializers.ValidationError(
                        f"Stock insuficiente para {product.name}: disponible {total_stock} ud."
                    )
        return items



class ReturnSerializer(serializers.ModelSerializer):
    returned_variant_display = serializers.SerializerMethodField()
    swapped_variant_display = serializers.SerializerMethodField()
    processed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Return
        fields = [
            "id", "type", "reason", "original_sale",
            "returned_variant", "returned_variant_display",
            "returned_quantity", "returned_price",
            "swapped_variant", "swapped_variant_display",
            "swapped_quantity", "swapped_price",
            "price_difference", "note",
            "processed_by", "processed_by_name",
            "cash_session", "created_at"
        ]
        read_only_fields = ["price_difference", "processed_by", "created_at"]

    def get_returned_variant_display(self, obj):
        return str(obj.returned_variant)

    def get_swapped_variant_display(self, obj):
        return str(obj.swapped_variant) if obj.swapped_variant else None

    def get_processed_by_name(self, obj):
        return obj.processed_by.get_full_name() if obj.processed_by else None

    def validate(self, data):
        if data.get("type") == "swap":
            if not data.get("swapped_variant"):
                raise serializers.ValidationError(
                    "Un cambio requiere la variante de reemplazo."
                )
            if not data.get("swapped_quantity"):
                raise serializers.ValidationError(
                    "Un cambio requiere la cantidad de la variante de reemplazo."
                )
            # Verificar stock de la variante que sale
            swapped = data["swapped_variant"]
            qty = data["swapped_quantity"]
            if swapped.stock < qty:
                raise serializers.ValidationError(
                    f"Stock insuficiente para {swapped}. Disponible: {swapped.stock}"
                )
        return data
