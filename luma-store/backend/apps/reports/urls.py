from django.urls import path
from .views import (
    DashboardView,
    InventoryAlertsView,
    SalesReportView,
    InventoryReportView,
    ProductReportView,
    CustomerReportView,
    CashReportView,
    ExportSalesView,
    ExportInventoryView,
    ExportProductsView,
    ExportCustomersView,
    ExportCashView,
)

urlpatterns = [
    path("dashboard/",          DashboardView.as_view(),        name="dashboard"),
    path("inventory-alerts/",   InventoryAlertsView.as_view(),  name="inventory-alerts"),
    path("sales/",            SalesReportView.as_view(),     name="report-sales"),
    path("inventory/",        InventoryReportView.as_view(), name="report-inventory"),
    path("products/",         ProductReportView.as_view(),   name="report-products"),
    path("customers/",        CustomerReportView.as_view(),  name="report-customers"),
    path("cash/",             CashReportView.as_view(),      name="report-cash"),
    path("export/sales/",     ExportSalesView.as_view(),     name="export-sales"),
    path("export/inventory/", ExportInventoryView.as_view(), name="export-inventory"),
    path("export/products/",  ExportProductsView.as_view(),  name="export-products"),
    path("export/customers/", ExportCustomersView.as_view(), name="export-customers"),
    path("export/cash/",      ExportCashView.as_view(),      name="export-cash"),
]
