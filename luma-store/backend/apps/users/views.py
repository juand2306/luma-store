from rest_framework import viewsets, generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model

from .models import StoreConfig
from .serializers import (
    UserSerializer, UserMeSerializer,
    StoreConfigSerializer, PublicStoreConfigSerializer
)
from .permissions import IsOwner, IsOwnerOrAdmin

User = get_user_model()

# Métodos de pago predeterminados del sistema
DEFAULT_PAYMENT_METHODS = [
    {"key": "cash",      "label": "Efectivo",       "enabled": True},
    {"key": "transfer",  "label": "Transferencia",  "enabled": True},
    {"key": "nequi",     "label": "Nequi",          "enabled": True},
    {"key": "daviplata", "label": "Daviplata",      "enabled": True},
    {"key": "debit",     "label": "Tarjeta Débito", "enabled": True},
    {"key": "credit",    "label": "Tarjeta Crédito","enabled": False},
    {"key": "other",     "label": "Otro",           "enabled": False},
]


class UserViewSet(viewsets.ModelViewSet):
    """CRUD de usuarios del equipo. Solo Owner."""
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [IsOwner]

    def destroy(self, request, *args, **kwargs):
        """No se elimina un usuario, solo se desactiva."""
        user = self.get_object()
        user.is_active = False
        user.save()
        return Response({"detail": "Usuario desactivado."}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveAPIView):
    """Devuelve los datos del usuario autenticado."""
    serializer_class = UserMeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class StoreConfigView(generics.RetrieveUpdateAPIView):
    """Leer y actualizar configuración de la tienda. Solo Owner."""
    serializer_class = StoreConfigSerializer
    permission_classes = [IsOwner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return StoreConfig.get_config()


class PaymentMethodsView(APIView):
    """
    Gestión de métodos de pago configurados para la tienda.
    GET  — retorna lista de métodos (con defaults si no hay configurados)
    PUT  — reemplaza la lista completa
    """
    permission_classes = [IsOwnerOrAdmin]

    def _get_methods(self):
        config = StoreConfig.get_config()
        methods = config.payment_methods
        if not methods:
            # Poblar con defaults si está vacío
            methods = DEFAULT_PAYMENT_METHODS
            config.payment_methods = methods
            config.save(update_fields=["payment_methods"])
        return config, methods

    def get(self, request):
        _, methods = self._get_methods()
        return Response(methods)

    def put(self, request):
        config, _ = self._get_methods()
        data = request.data
        if not isinstance(data, list):
            return Response({"detail": "Se esperaba una lista de métodos de pago."}, status=400)
        # Validar cada método
        for m in data:
            if not m.get("key") or not m.get("label"):
                return Response(
                    {"detail": "Cada método debe tener 'key' y 'label'."},
                    status=400
                )
        config.payment_methods = data
        config.save(update_fields=["payment_methods"])
        return Response(data)


class PublicStoreConfigView(generics.RetrieveAPIView):
    """Configuración pública de la tienda (sin datos sensibles). Sin autenticación."""
    serializer_class = PublicStoreConfigSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        return StoreConfig.get_config()
