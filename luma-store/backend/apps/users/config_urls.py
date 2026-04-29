from django.urls import path
from .views import StoreConfigView, PaymentMethodsView

urlpatterns = [
    path("store/",           StoreConfigView.as_view(),    name="config-store"),
    path("payment-methods/", PaymentMethodsView.as_view(), name="config-payment-methods"),
]
