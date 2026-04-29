import csv
import io
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from apps.users.permissions import IsOwnerAdminOrSeller
from django_filters.rest_framework import DjangoFilterBackend

from .models import Category, Product, ProductImage, ProductVariant, StockMovement
from .serializers import (
    CategorySerializer,
    ProductSerializer, ProductListSerializer,
    ProductImageSerializer,
    ProductVariantSerializer, ProductVariantWriteSerializer,
    StockMovementSerializer,
    PublicProductSerializer,
)
from apps.users.permissions import IsOwnerOrAdmin


class ProductImageViewSet(viewsets.ModelViewSet):
    """Gestión de imágenes de productos: subida, eliminación y establecer como principal."""
    queryset = ProductImage.objects.all()
    serializer_class = ProductImageSerializer
    permission_classes = [IsOwnerOrAdmin]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = ProductImage.objects.select_related("product")
        product_id = self.request.query_params.get("product")
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        # Si es la primera imagen del producto, marcarla como principal
        if not ProductImage.objects.filter(product=instance.product, is_main=True).exclude(pk=instance.pk).exists():
            instance.is_main = True
            instance.save(update_fields=["is_main"])

    def partial_update(self, request, *args, **kwargs):
        """PATCH: permite marcar como imagen principal."""
        instance = self.get_object()
        if request.data.get("is_main"):
            # Des-marcar todas las demás
            ProductImage.objects.filter(product=instance.product).update(is_main=False)
            instance.is_main = True
            instance.save(update_fields=["is_main"])
        return Response(ProductImageSerializer(instance).data)




class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.filter(parent=None).prefetch_related(
        "subcategories"
    ).order_by("order", "name")
    serializer_class = CategorySerializer
    permission_classes = [IsOwnerOrAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if category.products.filter(status="active").exists():
            return Response(
                {"detail": "No se puede eliminar una categoría con productos activos."},
                status=status.HTTP_400_BAD_REQUEST
            )
        category.is_active = False
        category.save()
        return Response({"detail": "Categoría desactivada."}, status=status.HTTP_200_OK)


class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsOwnerOrAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["category", "status", "is_visible", "is_featured"]
    search_fields = ["name", "sku_base"]
    ordering_fields = ["name", "price", "created_at"]

    def get_queryset(self):
        return Product.objects.prefetch_related("variants", "images").all()

    def get_serializer_class(self):
        if self.action == "list":
            return ProductListSerializer
        return ProductSerializer

    @action(detail=False, methods=["post"], url_path="import")
    def import_csv(self, request):
        """Importar productos desde CSV.
        Columnas: name* price* cost description min_stock
        Crea borradores (inactive, is_visible=False).
        """
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No se adjuntó ningún archivo."}, status=400)
        try:
            raw = file.read()
            content = raw.decode("utf-8-sig")  # soporta BOM de Excel
            reader = csv.DictReader(io.StringIO(content))
            errors = []
            created = 0
            for i, row in enumerate(reader, start=2):
                try:
                    name      = row.get("name", "").strip()
                    price_raw = row.get("price", "").strip()
                    if not name:
                        errors.append(f"Fila {i}: el campo 'name' es obligatorio.")
                        continue
                    if not price_raw:
                        errors.append(f"Fila {i}: el campo 'price' es obligatorio.")
                        continue
                    try:
                        price_val = float(price_raw)
                    except ValueError:
                        errors.append(f"Fila {i}: 'price' debe ser un número (recibido: '{price_raw}').")
                        continue
                    cost_raw = row.get("cost", "").strip()
                    try:
                        cost_val = float(cost_raw) if cost_raw else 0
                    except ValueError:
                        cost_val = 0
                    min_stock_raw = row.get("min_stock", "").strip()
                    try:
                        min_stock_val = int(min_stock_raw) if min_stock_raw else 3
                    except ValueError:
                        min_stock_val = 3
                    Product.objects.create(
                        name=name,
                        price=price_val,
                        cost=cost_val,
                        description=row.get("description", "").strip(),
                        min_stock=min_stock_val,
                        status="inactive",
                        is_visible=False,
                    )
                    created += 1
                except Exception as e:
                    errors.append(f"Fila {i}: {str(e)}")
            n_err = len(errors)
            return Response({
                "created": created,
                "errors":  errors,
                "message": (
                    f"{created} producto{'s' if created != 1 else ''} importado{'s' if created != 1 else ''}."
                    + (f" {n_err} fila{'s' if n_err != 1 else ''} con error{'es' if n_err != 1 else ''}." if n_err else "")
                ),
            })
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=["get"], url_path="search-for-sale",
            permission_classes=[IsOwnerAdminOrSeller])
    def search_for_sale(self, request):
        """
        Búsqueda optimizada para el punto de venta.
        Retorna variantes con stock > 0 como lista plana, lista para agregar al carrito.
        Parámetros:
          - q: término de búsqueda (nombre o SKU)
          - limit: máximo de resultados (default 30)
        """
        q     = request.query_params.get("q", "").strip()
        limit = int(request.query_params.get("limit", 30))

        if not q:
            return Response([])

        variants = (
            ProductVariant.objects
            .select_related("product")
            .filter(
                is_active=True,
                stock__gt=0,
                product__status="active",
            )
            .filter(
                product__name__icontains=q
            )
            .order_by("product__name", "size", "color")[:limit]
        )

        # También buscar por SKU base
        variants_sku = (
            ProductVariant.objects
            .select_related("product")
            .filter(
                is_active=True,
                stock__gt=0,
                product__status="active",
                product__sku_base__icontains=q,
            )
            .order_by("product__name")[:limit]
        )

        # Unir y deduplicar
        seen = set()
        result = []
        for v in list(variants) + list(variants_sku):
            if v.id not in seen:
                seen.add(v.id)
                price = v.price if v.price else v.product.price
                result.append({
                    "id":            v.id,
                    "product_id":    v.product_id,
                    "product_name":  v.product.name,
                    "sku_base":      v.product.sku_base,
                    "size":          v.size,
                    "color":         v.color,
                    "stock":         v.stock,
                    "effective_price": str(price),
                    "product_price": str(v.product.price),
                })
        return Response(result[:limit])


class ProductVariantViewSet(viewsets.ModelViewSet):
    permission_classes = [IsOwnerOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["product", "is_active"]

    def get_queryset(self):
        return ProductVariant.objects.select_related("product").all()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ProductVariantWriteSerializer
        return ProductVariantSerializer

    def create(self, request, *args, **kwargs):
        write_ser = ProductVariantWriteSerializer(data=request.data, context={"request": request})
        write_ser.is_valid(raise_exception=True)
        variant = write_ser.save()
        read_ser = ProductVariantSerializer(variant, context={"request": request})
        from rest_framework import status as drf_status
        return Response(read_ser.data, status=drf_status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        write_ser = ProductVariantWriteSerializer(instance, data=request.data, partial=partial, context={"request": request})
        write_ser.is_valid(raise_exception=True)
        variant = write_ser.save()
        read_ser = ProductVariantSerializer(variant, context={"request": request})
        return Response(read_ser.data)


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related(
        "variant__product", "created_by"
    ).order_by("-created_at")
    serializer_class = StockMovementSerializer
    permission_classes = [IsOwnerOrAdmin]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["type", "variant", "variant__product"]
    ordering_fields = ["created_at"]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    http_method_names = ["get", "post", "head", "options"]  # No update/delete en movimientos


# ── Endpoints Públicos del Portal ──────────────────────────────────────────────

class PublicProductListView(viewsets.ReadOnlyModelViewSet):
    """Catálogo público — solo productos visibles."""
    serializer_class = PublicProductSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["category", "is_featured"]
    search_fields = ["name"]

    def get_queryset(self):
        qs = Product.objects.filter(
            is_visible=True, status__in=["active", "out"]
        ).prefetch_related("variants", "images")
        # Filtros adicionales desde query params
        size = self.request.query_params.get("size")
        color = self.request.query_params.get("color")
        min_price = self.request.query_params.get("min_price")
        max_price = self.request.query_params.get("max_price")
        only_available = self.request.query_params.get("available")

        if size:
            qs = qs.filter(variants__size__iexact=size, variants__is_active=True)
        if color:
            qs = qs.filter(variants__color__iexact=color, variants__is_active=True)
        if min_price:
            qs = qs.filter(price__gte=min_price)
        if max_price:
            qs = qs.filter(price__lte=max_price)
        if only_available == "true":
            qs = qs.filter(variants__stock__gt=0, variants__is_active=True)

        return qs.distinct()


class PublicCategoryListView(viewsets.ReadOnlyModelViewSet):
    """Categorías con al menos un producto visible (para el portal)."""
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Category.objects.filter(
            is_active=True,
            products__is_visible=True
        ).distinct().order_by("order", "name")
