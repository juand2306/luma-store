from django.urls import path
from .views import DashboardView, SalesReportView, InventoryReportView, ExportSalesView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("sales/", SalesReportView.as_view(), name="report-sales"),
    path("inventory/", InventoryReportView.as_view(), name="report-inventory"),
    path("export/sales/", ExportSalesView.as_view(), name="export-sales"),
]
