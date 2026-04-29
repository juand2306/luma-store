from rest_framework import serializers
from .models import CashSession, CashMovement
from django.db.models import Sum


class CashMovementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CashMovement
        fields = [
            "id", "session", "type", "amount", "description",
            "payment_method", "reference_id",
            "created_by", "created_by_name", "created_at"
        ]
        read_only_fields = ["created_by", "created_at"]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)


class CashSessionSerializer(serializers.ModelSerializer):
    movements = CashMovementSerializer(many=True, read_only=True)
    opened_by_name = serializers.SerializerMethodField()
    closed_by_name = serializers.SerializerMethodField()
    total_income = serializers.SerializerMethodField()
    total_expense = serializers.SerializerMethodField()
    total_refund = serializers.SerializerMethodField()
    current_cash = serializers.SerializerMethodField()

    class Meta:
        model = CashSession
        fields = [
            "id", "date", "opening_amount", "closing_amount",
            "counted_amount", "difference", "status", "note",
            "opened_by", "opened_by_name", "closed_by", "closed_by_name",
            "opened_at", "closed_at",
            "movements", "total_income", "total_expense",
            "total_refund", "current_cash"
        ]
        read_only_fields = [
            "closing_amount", "counted_amount", "difference",
            "opened_by", "closed_by", "opened_at", "closed_at", "status"
        ]

    def get_opened_by_name(self, obj):
        return obj.opened_by.get_full_name() if obj.opened_by else None

    def get_closed_by_name(self, obj):
        return obj.closed_by.get_full_name() if obj.closed_by else None

    def get_total_income(self, obj):
        return obj.movements.filter(type="income").aggregate(
            t=Sum("amount"))["t"] or 0

    def get_total_expense(self, obj):
        return obj.movements.filter(type="expense").aggregate(
            t=Sum("amount"))["t"] or 0

    def get_total_refund(self, obj):
        return obj.movements.filter(type="refund").aggregate(
            t=Sum("amount"))["t"] or 0

    def get_current_cash(self, obj):
        income = obj.movements.filter(type="income").aggregate(
            t=Sum("amount"))["t"] or 0
        expense = obj.movements.filter(type="expense").aggregate(
            t=Sum("amount"))["t"] or 0
        refund = obj.movements.filter(type="refund").aggregate(
            t=Sum("amount"))["t"] or 0
        return float(obj.opening_amount) + float(income) - float(expense) - float(refund)

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["opened_by"] = request.user
        return super().create(validated_data)


class CashSessionListSerializer(serializers.ModelSerializer):
    """Serializer liviano para listado de sesiones — incluye campos de cierre."""
    opened_by_name = serializers.SerializerMethodField()
    closed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CashSession
        fields = [
            "id", "date", "opening_amount", "closing_amount",
            "counted_amount", "difference", "status", "note",
            "opened_by_name", "closed_by_name",
            "opened_at", "closed_at",
        ]

    def get_opened_by_name(self, obj):
        return obj.opened_by.get_full_name() if obj.opened_by else None

    def get_closed_by_name(self, obj):
        return obj.closed_by.get_full_name() if obj.closed_by else None
