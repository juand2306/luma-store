from django.contrib import admin
from .models import Customer, LoyaltyConfig


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "email", "points", "created_at"]
    search_fields = ["name", "phone", "email"]


@admin.register(LoyaltyConfig)
class LoyaltyConfigAdmin(admin.ModelAdmin):
    list_display = ["is_enabled", "points_per_amount", "value_per_point", "min_points_redeem"]
