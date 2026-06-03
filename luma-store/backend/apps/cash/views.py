import datetime
from django.db.models import Sum, Case, When, Value, DecimalField
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import CashSession, CashMovement
from .serializers import (
    CashSessionSerializer, CashSessionListSerializer, CashMovementSerializer
)
from apps.users.permissions import IsOwnerOrAdmin


# ──────────────────────────────────────────────────────────────────────────────
#  Utilidad: auto-cierre de sesiones de días anteriores
# ──────────────────────────────────────────────────────────────────────────────

def _auto_close_stale_sessions():
    """
    Cierra automáticamente todas las sesiones abiertas de días anteriores al día actual.
    - Calcula el monto de cierre desde los movimientos (una sola query con anotaciones).
    - Asigna closed_at = 23:59:59 del día de la sesión (hora local del servidor).
    - No genera una diferencia porque no hubo conteo físico.
    Retorna la lista de sesiones cerradas (puede estar vacía).
    """
    today = timezone.localdate()

    # Una sola query: trae sesiones abiertas de días anteriores con sus totales
    stale = list(
        CashSession.objects
        .filter(status=CashSession.Status.OPEN, date__lt=today)
        .annotate(
            income_total=Sum(
                Case(When(movements__type="income",  then="movements__amount"),
                     default=Value(0), output_field=DecimalField())
            ),
            expense_total=Sum(
                Case(When(movements__type="expense", then="movements__amount"),
                     default=Value(0), output_field=DecimalField())
            ),
            refund_total=Sum(
                Case(When(movements__type="refund",  then="movements__amount"),
                     default=Value(0), output_field=DecimalField())
            ),
        )
    )

    if not stale:
        return []

    for session in stale:
        income  = float(session.income_total  or 0)
        expense = float(session.expense_total or 0)
        refund  = float(session.refund_total  or 0)
        closing_amount = float(session.opening_amount) + income - expense - refund

        # Timestamp de cierre: 23:59:59 del día de la sesión (zona horaria local)
        naive_end = datetime.datetime.combine(session.date, datetime.time(23, 59, 59))
        closed_at = timezone.make_aware(naive_end)

        CashSession.objects.filter(pk=session.pk).update(
            closing_amount=closing_amount,
            counted_amount=None,   # Sin conteo físico — no aplica
            difference=None,       # Sin diferencia — no aplica
            status=CashSession.Status.CLOSED,
            auto_closed=True,
            closed_at=closed_at,
            note=session.note or "Cerrada automáticamente por el sistema a la medianoche.",
        )

        # Actualizar la instancia en memoria para que la respuesta sea correcta
        session.closing_amount = closing_amount
        session.status         = CashSession.Status.CLOSED
        session.auto_closed    = True
        session.closed_at      = closed_at

    return stale


# ──────────────────────────────────────────────────────────────────────────────
#  ViewSets
# ──────────────────────────────────────────────────────────────────────────────

class CashSessionViewSet(viewsets.ModelViewSet):
    """Gestión de sesiones de caja."""
    permission_classes = [IsOwnerOrAdmin]
    http_method_names  = ["get", "post", "head", "options"]  # No editar/eliminar sesiones

    def get_queryset(self):
        qs = CashSession.objects.select_related(
            "opened_by", "closed_by"
        ).prefetch_related("movements__created_by").order_by("-date")
        date_param    = self.request.query_params.get("date")
        status_filter = self.request.query_params.get("status")
        if date_param:
            qs = qs.filter(date=date_param)
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
        """Abrir caja del día. Auto-cierra sesiones de días anteriores antes de crear."""
        today = timezone.localdate()
        # Auto-cerrar sesiones olvidadas de días anteriores
        _auto_close_stale_sessions()
        if CashSession.objects.filter(date=today).exists():
            return Response(
                {"detail": "Ya existe una sesión de caja para hoy."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="check-stale")
    def check_stale(self, request):
        """
        Cierra automáticamente sesiones abiertas de días anteriores.
        Llamado por el frontend al cargar la página de Caja.
        Responde con cuántas sesiones se auto-cerraron y sus fechas.
        """
        closed = _auto_close_stale_sessions()
        return Response({
            "auto_closed_count": len(closed),
            "auto_closed_sessions": [
                {
                    "id":             s.id,
                    "date":           str(s.date),
                    "closing_amount": float(s.closing_amount),
                }
                for s in closed
            ],
        })

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        """Cerrar la caja del día con conteo físico."""
        session = self.get_object()
        if session.status == CashSession.Status.CLOSED:
            return Response(
                {"detail": "Esta sesión ya está cerrada."},
                status=status.HTTP_400_BAD_REQUEST
            )

        counted_amount = request.data.get("counted_amount")
        note           = request.data.get("note", "")
        if counted_amount is None:
            return Response(
                {"detail": "Debe ingresar el monto contado físicamente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Usar prefetch cache: session.movements.all() no hace nueva query
        income = expense = refund = 0.0
        for m in session.movements.all():
            if m.type == "income":
                income  += float(m.amount)
            elif m.type == "expense":
                expense += float(m.amount)
            elif m.type == "refund":
                refund  += float(m.amount)

        closing_amount = float(session.opening_amount) + income - expense - refund
        difference     = float(counted_amount) - closing_amount

        session.closing_amount = closing_amount
        session.counted_amount = counted_amount
        session.difference     = difference
        session.status         = CashSession.Status.CLOSED
        session.auto_closed    = False
        session.note           = note
        session.closed_by      = request.user
        session.closed_at      = timezone.now()
        session.save(update_fields=[
            "closing_amount", "counted_amount", "difference",
            "status", "auto_closed", "note", "closed_by", "closed_at",
        ])

        return Response(CashSessionSerializer(session, context={"request": request}).data)


class CashMovementViewSet(viewsets.ModelViewSet):
    """Movimientos de caja manuales (egresos, ingresos extras)."""
    serializer_class   = CashMovementSerializer
    permission_classes = [IsOwnerOrAdmin]
    http_method_names  = ["get", "post", "head", "options"]  # No editar movimientos ya registrados

    def get_queryset(self):
        """Usar get_queryset() en lugar de queryset de clase para evitar datos stale."""
        qs = CashMovement.objects.select_related(
            "session", "created_by"
        ).order_by("-created_at")
        session_id = self.request.query_params.get("session")
        if session_id:
            qs = qs.filter(session_id=session_id)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx
