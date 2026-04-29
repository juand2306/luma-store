from django.contrib import admin
from .models import Category, Product, ProductImage, ProductVariant, StockMovement


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "parent", "order", "is_active"]
    list_filter = ["is_active"]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "sku_base", "category", "price", "status", "is_visible"]
    list_filter = ["status", "is_visible", "category"]
    search_fields = ["name", "sku_base"]


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ["product", "size", "color", "sku", "stock", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["sku", "barcode"]


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ["product", "order", "is_main"]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ["variant", "type", "quantity", "created_by", "created_at"]
    list_filter = ["type"]
