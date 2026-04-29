from django.contrib import admin
from .models import Sale, SaleItem, Return


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ["number", "total", "payment_method", "sold_by", "created_at"]
    list_filter = ["payment_method"]
    inlines = [SaleItemInline]


@admin.register(Return)
class ReturnAdmin(admin.ModelAdmin):
    list_display = ["type", "reason", "returned_variant", "returned_quantity", "created_at"]
    list_filter = ["type", "reason"]
