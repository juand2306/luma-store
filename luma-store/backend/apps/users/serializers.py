from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import StoreConfig

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=6)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "is_active", "date_joined", "password"
        ]
        read_only_fields = ["date_joined"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class UserMeSerializer(serializers.ModelSerializer):
    """Serializer de solo lectura para el endpoint /me/."""
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "is_active"]


class StoreConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreConfig
        fields = "__all__"


class PublicStoreConfigSerializer(serializers.ModelSerializer):
    """Solo expone datos públicos de la tienda (sin datos sensibles)."""
    class Meta:
        model = StoreConfig
        fields = [
            "name", "logo", "primary_color", "whatsapp",
            "address", "schedule", "return_policy",
            "banner_text", "banner_image",
        ]
