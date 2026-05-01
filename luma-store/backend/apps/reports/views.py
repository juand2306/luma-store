from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.db.models import Sum, Count, F

from apps.users.permissions import CanViewOnly
from apps.sales.models import Sale, SaleItem
from apps.orders.models import Order
from apps.inventory.models import ProductVariant, StockMovement, Product
from apps.cash.models import CashSession

import io
from django.http import HttpResponse


class DashboardView(APIView):
    """Dashboard con KPIs, gráfica de ventas y alertas de stock."""
    permission_classes = [CanViewOnly]

    def get(self, request):
        from datetime import date, timedelta
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        now = timezone.now()

        # ── Ventas del día ────────────────────────────────
        today_sales = Sale.objects.filter(created_at__date=today)
        today_revenue = today_sales.aggregate(t=Sum("total"))["t"] or 0
        today_count = today_sales.count()

        yesterday_sales = Sale.objects.filter(created_at__date=yesterday)
        yesterday_revenue = float(yesterday_sales.aggregate(t=Sum("total"))["t"] or 0)
        yesterday_count = yesterday_sales.count()

        # ── Pedidos nuevos ───────────────────────────────
        new_orders = Order.objects.filter(status="new").count()
        yesterday_new_orders = Order.objects.filter(
            status="new", created_at__date=yesterday
        ).count()

        # ── Stock bajo / agotado ──────────────────────────
        low_stock_count = ProductVariant.objects.filter(
            is_active=True, stock__gt=0, stock__lte=F("product__min_stock")
        ).count()
        out_of_stock_count = ProductVariant.objects.filter(is_active=True, stock=0).count()

        # ── Caja actual ───────────────────────────────────
        session = CashSession.objects.filter(date=today, status="open").first()
        cash_data = None
        if session:
            income = session.movements.filter(type="income").aggregate(t=Sum("amount"))["t"] or 0
            expense = session.movements.filter(type="expense").aggregate(t=Sum("amount"))["t"] or 0
            refund = session.movements.filter(type="refund").aggregate(t=Sum("amount"))["t"] or 0
            cash_data = {
                "session_id": session.id,
                "opening_amount": str(session.opening_amount),
                "current_cash": float(session.opening_amount) + float(income) - float(expense) - float(refund),
                "total_income": float(income),
                "total_expense": float(expense),
                "total_refund": float(refund),
            }

        # ── Gráfica de ventas — últimos 30 días ──────────
        sales_chart = []
        for i in range(29, -1, -1):
            day = today - timedelta(days=i)
            day_total = Sale.objects.filter(
                created_at__date=day
            ).aggregate(t=Sum("total"))["t"] or 0
            sales_chart.append({"date": str(day), "total": float(day_total)})

        # ── Gráfica de pedidos — últimos 14 días ─────────
        orders_chart = []
        for i in range(13, -1, -1):
            day = today - timedelta(days=i)
            day_count = Order.objects.filter(created_at__date=day).count()
            orders_chart.append({"date": str(day), "total": day_count})

        # ── Top 5 productos más vendidos (últimos 30 días) ─────
        thirty_days_ago = now - timezone.timedelta(days=30)
        top_products = (
            SaleItem.objects
            .filter(sale__created_at__gte=thirty_days_ago)
            .values("variant__product__id", "variant__product__name", "variant__product__category__name")
            .annotate(units_sold=Sum("quantity"), revenue=Sum("subtotal"))
            .order_by("-units_sold")[:5]
        )
        top_products_list = [
            {
                "product_id": p["variant__product__id"],
                "name": p["variant__product__name"],
                "category": p["variant__product__category__name"],
                "units_sold": p["units_sold"],
                "revenue": float(p["revenue"]),
            }
            for p in top_products
        ]

        # ── Alertas de stock bajo ─────────────────────────
        low_stock_variants = ProductVariant.objects.filter(
            is_active=True, stock__lte=F("product__min_stock")
        ).select_related("product").order_by("stock")[:20]

        stock_alerts = [
            {
                "variant_id": v.id,
                "product_id": v.product.id,
                "product_name": v.product.name,
                "size": v.size,
                "color": v.color,
                "current_stock": v.stock,
                "min_stock": v.product.min_stock,
                "urgency": "out" if v.stock == 0 else "critical" if v.stock <= 1 else "low",
            }
            for v in low_stock_variants
        ]

        # ── Pedidos recientes (últimos 5) ─────────────────
        recent_orders_qs = Order.objects.order_by("-created_at")[:5]
        recent_orders = [
            {
                "id": o.id,
                "number": o.number,
                "status": o.status,
                "total": float(o.total) if o.total else 0,
                "customer_name": o.customer_name or "Cliente anónimo",
            }
            for o in recent_orders_qs
        ]

        # ── Predicción de reabastecimiento ────────────────
        restock_alerts = _calculate_restock_alerts(thirty_days_ago)

        # ── % cambio vs ayer ──────────────────────────────
        def pct_change(today_val, yesterday_val):
            if yesterday_val == 0:
                return None
            return round(((today_val - yesterday_val) / yesterday_val) * 100, 1)

        return Response({
            "today_revenue": float(today_revenue),
            "today_sales_count": today_count,
            "yesterday_revenue": yesterday_revenue,
            "yesterday_sales_count": yesterday_count,
            "revenue_change": pct_change(float(today_revenue), yesterday_revenue),
            "sales_count_change": pct_change(today_count, yesterday_count),
            "new_orders": new_orders,
            "yesterday_new_orders": yesterday_new_orders,
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "cash_session": cash_data,
            "sales_chart": sales_chart,
            "orders_chart": orders_chart,
            "top_products": top_products_list,
            "stock_alerts": stock_alerts,
            "recent_orders": recent_orders,
            "restock_alerts": restock_alerts,
        })


def _calculate_restock_alerts(thirty_days_ago):
    """Calcula variantes con estimado < 10 días de stock."""
    alerts = []
    for variant in ProductVariant.objects.filter(is_active=True, stock__gt=0).select_related("product"):
        units_sold = StockMovement.objects.filter(
            variant=variant,
            type="sale",
            created_at__gte=thirty_days_ago
        ).aggregate(total=Sum("quantity"))["total"] or 0

        if units_sold > 0:
            daily_avg = abs(units_sold) / 30
            days_remaining = variant.stock / daily_avg
            if days_remaining < 10:
                alerts.append({
                    "variant_id": variant.id,
                    "product_id": variant.product.id,
                    "product_name": variant.product.name,
                    "size": variant.size,
                    "color": variant.color,
                    "current_stock": variant.stock,
                    "days_remaining": round(days_remaining, 1),
                })
    return sorted(alerts, key=lambda x: x["days_remaining"])


class SalesReportView(APIView):
    """Reporte de ventas con filtros — devuelve todos los datos para los gráficos del frontend."""
    permission_classes = [CanViewOnly]

    def get(self, request):
        from datetime import date, timedelta
        from django.db.models import Q

        days = int(request.query_params.get("days", 30))
        payment = request.query_params.get("payment_method")

        end_date   = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        qs = Sale.objects.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
        if payment:
            qs = qs.filter(payment_method=payment)

        # ── Totales ────────────────────────────────────────
        totals = qs.aggregate(total=Sum("total"), count=Count("id"))
        total_revenue = float(totals["total"] or 0)
        total_sales   = totals["count"] or 0
        daily_avg     = round(total_revenue / days, 2) if days else 0

        # ── Ventas por día ─────────────────────────────────
        sales_by_day = []
        for i in range(days - 1, -1, -1):
            day = end_date - timedelta(days=i)
            day_total = qs.filter(created_at__date=day).aggregate(t=Sum("total"))["t"] or 0
            sales_by_day.append({"date": str(day), "total": float(day_total)})

        # ── Top 5 productos ────────────────────────────────
        top_products = (
            SaleItem.objects.filter(sale__in=qs)
            .values("variant__product__id", "variant__product__name")
            .annotate(units_sold=Sum("quantity"), revenue=Sum("subtotal"))
            .order_by("-revenue")[:5]
        )
        top_products_list = [
            {
                "product_id": p["variant__product__id"],
                "name":       p["variant__product__name"],
                "units_sold": p["units_sold"],
                "revenue":    float(p["revenue"]),
            }
            for p in top_products
        ]

        # ── Métodos de pago ────────────────────────────────
        payment_methods = (
            qs.values("payment_method")
            .annotate(count=Count("id"), total=Sum("total"))
            .order_by("-count")
        )
        payment_list = [
            {"payment_method": p["payment_method"], "count": p["count"], "total": float(p["total"] or 0)}
            for p in payment_methods
        ]

        # ── Ventas por categoría ───────────────────────────
        by_category = (
            SaleItem.objects.filter(sale__in=qs)
            .values("variant__product__category__name")
            .annotate(revenue=Sum("subtotal"), count=Count("id"))
            .order_by("-revenue")
        )
        category_list = [
            {"category": c["variant__product__category__name"] or "Sin categoría",
             "revenue":  float(c["revenue"]),
             "count":    c["count"]}
            for c in by_category
        ]

        # ── Resumen de inventario ──────────────────────────
        all_variants = ProductVariant.objects.filter(is_active=True).select_related("product")
        total_stock = sum(v.stock for v in all_variants)
        out_of_stock_count = sum(1 for v in all_variants if v.stock == 0)
        low_stock_count    = sum(1 for v in all_variants if 0 < v.stock <= v.product.min_stock)
        inventory_value    = sum(float(v.product.price) * v.stock for v in all_variants)

        return Response({
            "total_revenue":       total_revenue,
            "total_sales":         total_sales,
            "daily_average":       daily_avg,
            "sales_by_day":        sales_by_day,
            "top_products":        top_products_list,
            "payment_methods":     payment_list,
            "sales_by_category":   category_list,
            # Inventario
            "total_stock":         total_stock,
            "out_of_stock":        out_of_stock_count,
            "low_stock":           low_stock_count,
            "inventory_value":     round(inventory_value, 2),
        })



class InventoryReportView(APIView):
    """Reporte del estado del inventario."""
    permission_classes = [CanViewOnly]

    def get(self, request):
        products = Product.objects.prefetch_related("variants").filter(status="active")
        total_cost_value = sum(
            float(p.cost) * sum(v.stock for v in p.variants.all())
            for p in products
        )
        total_sale_value = sum(
            float(p.price) * sum(v.stock for v in p.variants.all())
            for p in products
        )
        return Response({
            "total_products": products.count(),
            "total_cost_value": total_cost_value,
            "total_sale_value": total_sale_value,
            "potential_margin": total_sale_value - total_cost_value,
        })


class ExportSalesView(APIView):
    """Exportar ventas - devuelve base64 JSON para evitar corrupcion binaria en proxies."""
    permission_classes = [CanViewOnly]

    def get(self, request):
        import base64
        from datetime import date, timedelta

        qs = Sale.objects.select_related("sold_by", "customer").prefetch_related(
            "items__variant__product"
        ).order_by("-created_at")

        days      = request.query_params.get("days")
        from_date = request.query_params.get("from_date")
        to_date   = request.query_params.get("to_date")

        if days:
            try:
                cutoff = date.today() - timedelta(days=int(days))
                qs = qs.filter(created_at__date__gte=cutoff)
            except (ValueError, TypeError):
                pass
        else:
            if from_date:
                qs = qs.filter(created_at__date__gte=from_date)
            if to_date:
                qs = qs.filter(created_at__date__lte=to_date)

        fmt_val = request.query_params.get("file_format", "xlsx").lower()

        # CSV
        if fmt_val == "csv":
            import csv as csv_mod
            buffer = io.StringIO()
            writer = csv_mod.writer(buffer)
            writer.writerow(["Numero", "Fecha", "Cliente", "Subtotal", "Total",
                             "Metodo Pago", "Vendedor", "Puntos Usados", "Puntos Ganados"])
            for sale in qs:
                writer.writerow([
                    sale.number,
                    sale.created_at.strftime("%Y-%m-%d %H:%M"),
                    sale.customer.name if sale.customer else "",
                    float(sale.subtotal),
                    float(sale.total),
                    sale.get_payment_method_display(),
                    sale.sold_by.get_full_name() if sale.sold_by else "",
                    sale.points_used,
                    sale.points_earned,
                ])
            b64 = base64.b64encode(buffer.getvalue().encode("utf-8")).decode("utf-8")
            return Response({"format": "csv", "filename": f"ventas-{date.today()}.csv", "data": b64})

        # Excel - base64 en JSON evita corrupcion binaria
        try:
            import openpyxl
            from openpyxl.styles import Font, PatternFill, Alignment
        except ImportError:
            return Response({"detail": "openpyxl no instalado. Usa format=csv."}, status=500)

        try:
            from apps.users.models import StoreConfig
            store_name = StoreConfig.get_config().name
        except Exception:
            store_name = "LUMA Store"

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Ventas"

        ws.merge_cells("A1:J1")
        hc = ws["A1"]
        hc.value     = f"Reporte de Ventas - {store_name}"
        hc.font      = Font(bold=True, size=14, color="FFFFFF")
        hc.alignment = Alignment(horizontal="center")
        hc.fill      = PatternFill("solid", fgColor="0D8585")

        ws.append([])
        cols = ["#", "Numero", "Fecha", "Cliente", "Subtotal", "Descuento",
                "Total", "Metodo Pago", "Vendedor", "Pts Ganados"]
        ws.append(cols)
        for cell in ws[3]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="0D8585")

        for i, sale in enumerate(qs, 1):
            discount = float(sale.subtotal) - float(sale.total)
            ws.append([
                i,
                sale.number,
                sale.created_at.strftime("%Y-%m-%d %H:%M"),
                sale.customer.name if sale.customer else "-",
                float(sale.subtotal),
                round(discount, 2),
                float(sale.total),
                sale.get_payment_method_display(),
                sale.sold_by.get_full_name() if sale.sold_by else "-",
                sale.points_earned,
            ])

        for col in ws.columns:
            real_cells = [c for c in col if c.__class__.__name__ != "MergedCell"]
            if not real_cells:
                continue
            max_len = max((len(str(c.value or "")) for c in real_cells), default=10)
            ws.column_dimensions[real_cells[0].column_letter].width = min(max_len + 4, 40)

        buf = io.BytesIO()
        wb.save(buf)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return Response({"format": "xlsx", "filename": f"ventas-{date.today()}.xlsx", "data": b64})
