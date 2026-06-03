from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count, Max, Q, F
from django.utils import timezone
from datetime import timedelta

from .models import Customer, LoyaltyConfig
from .serializers import CustomerSerializer, LoyaltyConfigSerializer
from apps.users.permissions import IsOwnerOrAdmin, IsOwnerAdminOrSeller


def _annotated_customers_qs():
    """
    Queryset base con todas las anotaciones necesarias para el serializer.
    Resuelve total_purchases, purchase_count, last_purchase y conteos de
    ventas por período (para cálculo de segmento) en UNA sola query.
    """
    now = timezone.now()
    return Customer.objects.annotate(
        total_purchases_annotated=Sum("sales__total"),
        purchase_count_annotated=Count("sales", distinct=True),
        last_purchase_annotated=Max("sales__created_at"),
        sales_last_15=Count(
            "sales",
            filter=Q(sales__created_at__gte=now - timedelta(days=15)),
        ),
        sales_last_60=Count(
            "sales",
            filter=Q(sales__created_at__gte=now - timedelta(days=60)),
        ),
    )


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "create"):
            return [IsOwnerAdminOrSeller()]
        return [IsOwnerOrAdmin()]

    def get_queryset(self):
        qs = _annotated_customers_qs().order_by("-created_at")
        search = self.request.query_params.get("search")
        segment = self.request.query_params.get("segment")
        order_by = self.request.query_params.get("order_by")
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(phone__icontains=search)
                | Q(email__icontains=search)
            )
        # Filtro por segmento basado en anotaciones (sin tocar el property)
        if segment == "new":
            qs = qs.filter(
                sales_last_15=1,
                created_at__gte=timezone.now() - timedelta(days=15),
            )
        elif segment == "frequent":
            qs = qs.filter(sales_last_60__gt=3)
        elif segment == "regular":
            qs = qs.filter(sales_last_60__gte=1, sales_last_60__lte=3)
        elif segment == "inactive":
            qs = qs.filter(sales_last_60=0)
        if order_by == "purchases":
            qs = qs.order_by("-purchase_count_annotated")
        elif order_by == "spent":
            # nulls_last=True: clientes sin compras van al final, no al principio (PostgreSQL)
            qs = qs.order_by(F("total_purchases_annotated").desc(nulls_last=True))
        elif order_by == "points":
            qs = qs.order_by("-points")
        elif order_by == "name":
            qs = qs.order_by("name")
        elif order_by == "recent":
            # nulls_last=True: clientes sin compras van al final (no al principio) en PostgreSQL
            qs = qs.order_by(F("last_purchase_annotated").desc(nulls_last=True))
        return qs

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Agregados globales de clientes (sin filtros — panel de control)."""
        from apps.sales.models import Sale
        total_revenue = Sale.objects.aggregate(total=Sum("total"))["total"] or 0
        total_points  = Customer.objects.aggregate(total=Sum("points"))["total"] or 0
        total_count   = Customer.objects.count()
        return Response({
            "total_count":   total_count,
            "total_revenue": float(total_revenue),
            "total_points":  int(total_points),
        })


class LoyaltyConfigView(generics.RetrieveUpdateAPIView):
    """Configuración del sistema de fidelización. Solo Owner."""
    serializer_class = LoyaltyConfigSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_object(self):
        obj, _ = LoyaltyConfig.objects.get_or_create(
            pk=1, defaults={"is_enabled": False}
        )
        return obj
