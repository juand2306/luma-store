from rest_framework import viewsets, generics, status
from rest_framework.response import Response

from .models import Customer, LoyaltyConfig
from .serializers import CustomerSerializer, LoyaltyConfigSerializer
from apps.users.permissions import IsOwnerOrAdmin, IsOwnerAdminOrSeller


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().order_by("-created_at")
    serializer_class = CustomerSerializer

    def get_permissions(self):
        # Sellers can list/retrieve/create (needed during a sale), but only owner/admin can edit/delete
        if self.action in ("list", "retrieve", "create"):
            return [IsOwnerAdminOrSeller()]
        return [IsOwnerOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(name__icontains=search) | Q(phone__icontains=search))
        return qs


class LoyaltyConfigView(generics.RetrieveUpdateAPIView):
    """Configuración del sistema de fidelización. Solo Owner."""
    serializer_class = LoyaltyConfigSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_object(self):
        obj, _ = LoyaltyConfig.objects.get_or_create(
            pk=1, defaults={"is_enabled": False}
        )
        return obj
