from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import CashSession, CashMovement
from .serializers import (
    CashSessionSerializer, CashSessionListSerializer, CashMovementSerializer
)
from apps.users.permissions import IsOwnerOrAdmin


class CashSessionViewSet(viewsets.ModelViewSet):
    """Gestión de sesiones de caja."""
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        qs = CashSession.objects.prefetch_related("movements").order_by("-date")
        date = self.request.query_params.get("date")
        status_filter = self.request.query_params.get("status")
        if date:
            qs = qs.filter(date=date)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return CashSessionListSerializer
        return CashSessionSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        today = timezone.now().date()
        if CashSession.objects.filter(date=today).exists():
            return Response(
                {"detail": "Ya existe una sesión de caja para hoy."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        """Cerrar la caja del día."""
        session = self.get_object()
        if session.status == "closed":
            return Response(
                {"detail": "Esta sesión ya está cerrada."},
                status=status.HTTP_400_BAD_REQUEST
            )
        counted_amount = request.data.get("counted_amount")
        note = request.data.get("note", "")
        if counted_amount is None:
            return Response(
                {"detail": "Debe ingresar el monto contado físicamente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calcular el monto esperado
        from django.db.models import Sum
        income = session.movements.filter(type="income").aggregate(
            t=Sum("amount"))["t"] or 0
        expense = session.movements.filter(type="expense").aggregate(
            t=Sum("amount"))["t"] or 0
        refund = session.movements.filter(type="refund").aggregate(
            t=Sum("amount"))["t"] or 0

        closing_amount = float(session.opening_amount) + float(income) - float(expense) - float(refund)
        difference = float(counted_amount) - closing_amount

        session.closing_amount = closing_amount
        session.counted_amount = counted_amount
        session.difference = difference
        session.status = "closed"
        session.note = note
        session.closed_by = request.user
        session.closed_at = timezone.now()
        session.save()

        return Response(CashSessionSerializer(session, context={"request": request}).data)

    http_method_names = ["get", "post", "head", "options"]  # No editar/eliminar sesiones


class CashMovementViewSet(viewsets.ModelViewSet):
    """Movimientos de caja manuales (egresos, ingresos extras)."""
    queryset = CashMovement.objects.select_related(
        "session", "created_by"
    ).order_by("-created_at")
    serializer_class = CashMovementSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    http_method_names = ["get", "post", "head", "options"]  # No editar movimientos ya registrados
