from rest_framework import serializers
from django.db.models import Sum, Count
from .models import Customer, LoyaltyConfig
from apps.sales.models import Sale
from apps.orders.models import Order


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

    def get_segment(self, obj):
        return obj.segment

    def get_segment_display(self, obj):
        labels = {
            "new": "Nuevo",
            "frequent": "Frecuente",
            "regular": "Regular",
            "inactive": "Inactivo",
        }
        return labels.get(obj.segment, "—")

    def get_total_purchases(self, obj):
        result = Sale.objects.filter(customer=obj).aggregate(total=Sum("total"))
        return result["total"] or 0

    def get_purchase_count(self, obj):
        return Sale.objects.filter(customer=obj).count()

    def get_last_purchase(self, obj):
        sale = Sale.objects.filter(customer=obj).order_by("-created_at").first()
        return sale.created_at if sale else None


class LoyaltyConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyConfig
        fields = [
            "id", "is_enabled", "points_per_amount",
            "value_per_point", "min_points_redeem"
        ]
