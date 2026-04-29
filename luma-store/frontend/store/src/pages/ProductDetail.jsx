import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ShoppingCart, ArrowLeft, Minus, Plus, Share2, Loader2,
  CheckCircle2, AlertCircle
} from "lucide-react";
import storeClient from "../api/storeClient";
import ProductGallery from "../components/ProductGallery";
import { useCart } from "../context/CartContext";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, openCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    setLoading(true);
    storeClient
      .get(`/store/products/${id}/`)
      .then((r) => {
        setProduct(r.data);
        document.title = `${r.data.name} — LUMA Store`;
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500 px-4">
        <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
        <h2 className="font-bold text-gray-800 text-xl mb-2">Producto no encontrado</h2>
        <p className="text-sm mb-6">Es posible que el producto ya no esté disponible.</p>
        <Link to="/catalogo" className="px-6 py-2.5 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  // ── Derivar atributos disponibles ─────────────────────────────────────────
  const activeVariants = product.variants?.filter((v) => v.is_active) || [];
  const availableSizes = [...new Set(activeVariants.filter((v) => v.size).map((v) => v.size))];
  const availableColors = [...new Set(
    activeVariants
      .filter((v) => !selectedSize || v.size === selectedSize)
      .filter((v) => v.color)
      .map((v) => v.color)
  )];

  // Variante seleccionada
  const selectedVariant = activeVariants.find(
    (v) =>
      (availableSizes.length === 0 || v.size === selectedSize) &&
      (availableColors.length === 0 || v.color === selectedColor)
  );

  const effectiveStock = selectedVariant?.stock ?? 0;
  const effectivePrice = selectedVariant
    ? Number(selectedVariant.effective_price ?? selectedVariant.price ?? product.price)
    : Number(product.price);

  const canAdd =
    selectedVariant &&
    effectiveStock > 0 &&
    (availableSizes.length === 0 || selectedSize) &&
    (availableColors.length === 0 || selectedColor);

  const handleAddToCart = () => {
    if (!canAdd) return;
    const mainImage =
      product.images?.find((img) => img.is_main)?.image ||
      product.images?.[0]?.image ||
      null;

    addItem({
      variant_id: selectedVariant.id,
      product_id: product.id,
      product_name: product.name,
      size: selectedVariant.size,
      color: selectedVariant.color,
      unit_price: effectivePrice,
      quantity,
      max_stock: effectiveStock,
      image: mainImage,
    });

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
    openCart();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, url: window.location.href });
      } catch {}
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert("¡Enlace copiado al portapapeles!");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 hover:text-blue-600 transition"
          id="product-back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <span>/</span>
        <Link to="/catalogo" className="hover:text-blue-600 transition">Catálogo</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium line-clamp-1">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* ── Galería ──────────────────────────────────────────────────────── */}
        <div>
          <ProductGallery images={product.images || []} productName={product.name} />
        </div>

        {/* ── Info y acciones ────────────────────────────────────────────── */}
        <div className="flex flex-col space-y-6">
          {/* Categoría */}
          {product.category?.name && (
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">
              {product.category.name}
            </span>
          )}

          {/* Nombre */}
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">
            {product.name}
          </h1>

          {/* Precio */}
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-extrabold text-gray-900">
              ${effectivePrice.toLocaleString("es-CO")}
            </span>
            {selectedVariant && selectedVariant.price !== null && Number(selectedVariant.price) !== Number(product.price) && (
              <span className="text-lg text-gray-400 line-through">
                ${Number(product.price).toLocaleString("es-CO")}
              </span>
            )}
          </div>

          {/* Stock badge */}
          {selectedVariant && (
            <div className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full self-start ${
              effectiveStock > 0
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}>
              <div className={`w-2 h-2 rounded-full ${effectiveStock > 0 ? "bg-green-500" : "bg-red-500"}`} />
              {effectiveStock > 0
                ? `${effectiveStock} disponibles`
                : "Agotado"}
            </div>
          )}

          {/* Descripción */}
          {product.description && (
            <p className="text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
              {product.description}
            </p>
          )}

          {/* ── Selector de Talla ──────────────────────────────────────── */}
          {availableSizes.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Talla</h3>
                {selectedSize && (
                  <span className="text-sm text-blue-600 font-medium">{selectedSize}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((size) => {
                  const hasStock = activeVariants.some(
                    (v) => v.size === size && (!selectedColor || v.color === selectedColor) && v.stock > 0
                  );
                  return (
                    <button
                      key={size}
                      onClick={() => {
                        setSelectedSize(size);
                        setQuantity(1);
                        // Si el color ya no está disponible, limpiar
                        const colorAvailable = activeVariants.some(
                          (v) => v.size === size && v.color === selectedColor && v.is_active
                        );
                        if (!colorAvailable) setSelectedColor(null);
                      }}
                      disabled={!hasStock}
                      id={`size-btn-${size}`}
                      className={`min-w-[48px] h-12 px-4 text-sm font-semibold rounded-xl border-2 transition-all ${
                        selectedSize === size
                          ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200"
                          : !hasStock
                          ? "border-gray-200 text-gray-300 line-through cursor-not-allowed bg-gray-50"
                          : "border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Selector de Color ──────────────────────────────────────── */}
          {availableColors.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Color</h3>
                {selectedColor && (
                  <span className="text-sm text-blue-600 font-medium">{selectedColor}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((color) => {
                  const hasStock = activeVariants.some(
                    (v) => v.color === color && (!selectedSize || v.size === selectedSize) && v.stock > 0
                  );
                  return (
                    <button
                      key={color}
                      onClick={() => { setSelectedColor(color); setQuantity(1); }}
                      disabled={!hasStock}
                      id={`color-btn-${color}`}
                      className={`px-4 h-10 text-sm font-medium rounded-xl border-2 transition-all ${
                        selectedColor === color
                          ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200"
                          : !hasStock
                          ? "border-gray-200 text-gray-300 line-through cursor-not-allowed bg-gray-50"
                          : "border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Cantidad ──────────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="font-semibold text-gray-800 mb-3">Cantidad</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
                  id="qty-minus"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-bold text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(effectiveStock, q + 1))}
                  disabled={quantity >= effectiveStock || !selectedVariant}
                  className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
                  id="qty-plus"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {selectedVariant && effectiveStock > 0 && (
                <span className="text-xs text-gray-400">
                  Máximo {effectiveStock} unidades
                </span>
              )}
            </div>
          </div>

          {/* ── Acciones ──────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAddToCart}
              disabled={!canAdd}
              id="add-to-cart-btn"
              className={`flex-1 min-h-[52px] flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-all shadow-lg ${
                canAdd
                  ? addedFeedback
                    ? "bg-green-500 shadow-green-200 text-white"
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-200 text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
              }`}
            >
              {addedFeedback ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  ¡Agregado al carrito!
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  {!selectedSize && availableSizes.length > 0
                    ? "Selecciona una talla"
                    : !selectedColor && availableColors.length > 0
                    ? "Selecciona un color"
                    : effectiveStock === 0 && selectedVariant
                    ? "Agotado"
                    : "Agregar al carrito"}
                </>
              )}
            </button>

            <button
              onClick={handleShare}
              className="w-12 h-12 flex items-center justify-center border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600"
              aria-label="Compartir producto"
              id="share-product-btn"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          {/* Mensaje de validación */}
          {!canAdd && activeVariants.length > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {availableSizes.length > 0 && !selectedSize
                ? "Por favor selecciona una talla para continuar."
                : availableColors.length > 0 && !selectedColor
                ? "Por favor selecciona un color para continuar."
                : ""}
            </p>
          )}

          {/* Sin variantes activas */}
          {activeVariants.length === 0 && (
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-red-600 font-medium">Este producto no está disponible actualmente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
