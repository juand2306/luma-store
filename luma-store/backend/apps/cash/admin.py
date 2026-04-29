from django.contrib import admin
from .models import CashSession, CashMovement


@admin.register(CashSession)
class CashSessionAdmin(admin.ModelAdmin):
    list_display = ["date", "opening_amount", "closing_amount", "status", "opened_by"]
    list_filter = ["status"]


@admin.register(CashMovement)
class CashMovementAdmin(admin.ModelAdmin):
    list_display = ["session", "type", "amount", "payment_method", "description", "created_at"]
    list_filter = ["type", "payment_method"]
