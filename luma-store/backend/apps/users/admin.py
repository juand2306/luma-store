from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, StoreConfig


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Rol LUMA", {"fields": ("role",)}),
    )
    list_display = ["username", "email", "get_full_name", "role", "is_active"]
    list_filter = ["role", "is_active"]


@admin.register(StoreConfig)
class StoreConfigAdmin(admin.ModelAdmin):
    list_display = ["name", "whatsapp", "primary_color"]
