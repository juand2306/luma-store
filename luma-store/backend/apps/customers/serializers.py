from rest_framework import serializers
from django.db.models import Sum, Count
from .models import Customer, LoyaltyConfig


_SEGMENT_LABELS = {
    "new": "Nuevo",
    "frequent": "Frecuente",
    "regular": "Regular",
    "inactive": "Inactivo",
}


class CustomerSerializer(serializers.ModelSerializer):
    segment = serializers.SerializerMethodField()
    total_purchases = serializers.SerializerMethodField()
    purchase_count = serializers.SerializerMethodField()
    last_purchase = serializers.SerializerMethodField()
    segment_display = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id", "name", "phone", "email", "note",
            "points", "created_at", "segment", "segment_display",
            "total_purchases", "purchase_count", "last_purchase"
        ]
        read_only_fields = ["created_at", "points"]

    def _compute_segment(self, obj):
        """
        Calcula el segmento usando campos anotados cuando están disponibles
        (0 queries extra), o cae al property del modelo como fallback.
        El resultado se cachea en el objeto para no calcularlo dos veces.
        """
        if hasattr(obj, '_segment_cache'):
            return obj._segment_cache

        if hasattr(obj, 'sales_last_15') and hasattr(obj, 'sales_last_60'):
            from django.utils import timezone
            from datetime import timedelta
            last_15 = obj.sales_last_15 or 0
            last_60 = obj.sales_last_60 or 0
            is_new_customer = obj.created_at >= timezone.now() - timedelta(days=15)
            if last_15 == 1 and is_new_customer:
                seg = "new"
            elif last_60 > 3:
                seg = "frequent"
            elif last_60 >= 1:
                seg = "regular"
            else:
                seg = "inactive"
        else:
            seg = obj.segment  # fallback para vistas de detalle sin anotaciones

        obj._segment_cache = seg
        return seg

    def get_segment(self, obj):
        return self._compute_segment(obj)

    def get_segment_display(self, obj):
        return _SEGMENT_LABELS.get(self._compute_segment(obj), "—")

    def get_total_purchases(self, obj):
        # Usa el campo anotado cuando está disponible (0 queries extra)
        if hasattr(obj, 'total_purchases_annotated'):
            return obj.total_purchases_annotated or 0
        from apps.sales.models import Sale
        return Sale.objects.filter(customer=obj).aggregate(t=Sum("total"))["t"] or 0

    def get_purchase_count(self, obj):
        # Usa el campo anotado cuando está disponible (0 queries extra)
        if hasattr(obj, 'purchase_count_annotated'):
            return obj.purchase_count_annotated or 0
        from apps.sales.models import Sale
        return Sale.objects.filter(customer=obj).count()

    def get_last_purchase(self, obj):
        # Usa el campo anotado cuando está disponible (0 queries extra)
        if hasattr(obj, 'last_purchase_annotated'):
            return obj.last_purchase_annotated
        from apps.sales.models import Sale
        sale = Sale.objects.filter(customer=obj).order_by("-created_at").first()
        return sale.created_at if sale else None


class LoyaltyConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyConfig
        fields = [
            "id", "is_enabled", "points_per_amount",
            "value_per_point", "min_points_redeem"
        ]
