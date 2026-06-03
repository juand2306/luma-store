import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ShoppingCart, ArrowLeft, Minus, Plus, Share2, Loader2,
  CheckCircle2, AlertCircle
} from "lucide-react";
import storeClient from "../api/storeClient";
import ProductGallery from "../components/ProductGallery";
import ProductCarousel, { CarouselSkeleton } from "../components/ProductCarousel";
import { useCart } from "../context/CartContext";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, openCart } = useCart();

  const [product,        setProduct]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(false);
  const [related,        setRelated]        = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const [selectedSize,   setSelectedSize]   = useState(null);
  const [selectedColor,  setSelectedColor]  = useState(null);
  const [quantity,       setQuantity]       = useState(1);
  const [addedFeedback,  setAddedFeedback]  = useState(false);

  useEffect(() => {
    // Resetear scroll al inicio siempre que cambie el producto
    window.scrollTo(0, 0);

    setLoading(true);
    setSelectedSize(null);
    setSelectedColor(null);
    setQuantity(1);
    setRelated([]);
    setRelatedLoading(false);

    storeClient
      .get(`/store/products/${id}/`)
      .then((r) => {
        setProduct(r.data);
        document.title = `${r.data.name} — Tienda`;

        // ── Fetch de similares — resolver catId en cualquier formato ─────
        // El API puede devolver category como objeto {id,name} o como int.
        const catRaw   = r.data.category;
        const catId    = catRaw?.id                              // objeto { id }
                      ?? (typeof catRaw === "number" ? catRaw : null)  // entero
                      ?? r.data.category_id;                    // campo alternativo
        const parentId = catRaw?.parent?.id ?? catRaw?.parent ?? null;
        const selfId   = r.data.id;

        if (!catId) return; // sin categoría → no hay similares

        setRelatedLoading(true);

        // Etapa 1: misma categoría
        storeClient
          .get(`/store/products/?category=${catId}&page_size=9`)
          .then((res) => {
            const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
            const pool = data.filter((p) => p.id !== selfId);

            // Etapa 2: si <4 resultados y hay categoría padre, busca hermanos
            if (pool.length < 4 && parentId) {
              return storeClient
                .get(`/store/products/?category=${parentId}&page_size=12`)
                .then((res2) => {
                  const data2  = Array.isArray(res2.data) ? res2.data : (res2.data.results || []);
                  const known  = new Set(pool.map((p) => p.id));
                  known.add(selfId);
                  const extras = data2.filter((p) => !known.has(p.id));
                  return [...pool, ...extras];
                })
                .catch(() => pool);
            }

            return pool;
          })
          .then((finalPool) => {
            setRelated((finalPool || []).slice(0, 8));
          })
          .catch(() => {})
          .finally(() => setRelatedLoading(false));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-[3/4] bg-gray-100 animate-pulse" />
          <div className="space-y-5 pt-4">
            <div className="h-2.5 w-20 bg-gray-100 animate-pulse rounded" />
            <div className="h-8 w-2/3 bg-gray-100 animate-pulse rounded" />
            <div className="h-6 w-28 bg-gray-100 animate-pulse rounded" />
            <div className="h-px w-full bg-gray-100" />
            <div className="h-3 w-full bg-gray-100 animate-pulse rounded" />
            <div className="h-3 w-4/5 bg-gray-100 animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500 px-6">
        <AlertCircle className="w-10 h-10 mb-5 text-gray-200" />
        <h2
          className="text-2xl text-gray-800 mb-3"
          style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}
        >
          Producto no encontrado
        </h2>
        <p className="text-sm font-light text-gray-400 mb-8 text-center">
          Es posible que el producto ya no esté disponible.
        </p>
        <Link to="/catalogo" className="btn-primary text-sm px-8">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  // ── Derivar atributos disponibles ─────────────────────────────────────────
  const activeVariants   = product.variants?.filter((v) => v.is_active) || [];
  const availableSizes   = [...new Set(activeVariants.filter((v) => v.size).map((v) => v.size))];
  const availableColors  = [...new Set(
    activeVariants
      .filter((v) => !selectedSize || v.size === selectedSize)
      .filter((v) => v.color)
      .map((v) => v.color)
  )];

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

  // ── Resolver categoría: el endpoint puede devolver objeto {id,name} o entero ──
  const catRaw  = product.category;
  const catName = catRaw?.name ?? product.category_name ?? null;
  const catId   = catRaw?.id
               ?? (typeof catRaw === "number" ? catRaw : null)
               ?? product.category_id
               ?? null;

  const handleAddToCart = () => {
    if (!canAdd) return;
    const mainImage =
      product.images?.find((img) => img.is_main)?.image ||
      product.images?.[0]?.image ||
      null;

    addItem({
      variant_id:   selectedVariant.id,
      product_id:   product.id,
      product_name: product.name,
      size:         selectedVariant.size,
      color:        selectedVariant.color,
      unit_price:   effectivePrice,
      quantity,
      max_stock:    effectiveStock,
      image:        mainImage,
    });

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
    openCart();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url: window.location.href }); } catch {}
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div>
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
            id="product-back-btn"
          >
            <ArrowLeft className="w-3 h-3" />
            Volver
          </button>
          <span className="text-gray-200">·</span>
          <Link to="/catalogo" className="hover:text-gray-700 transition-colors">
            Catálogo
          </Link>
          <span className="text-gray-200">·</span>
          <span className="text-gray-500 truncate max-w-[180px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">

          {/* ── Galería ──────────────────────────────────────────────────────── */}
          <div>
            <ProductGallery images={product.images || []} productName={product.name} />
          </div>

          {/* ── Info y acciones ────────────────────────────────────────────── */}
          <div className="flex flex-col lg:pt-2">

            {/* Categoría — eyebrow en primary color */}
            {catName && (
              <p className="eyebrow mb-4" style={{ color: "var(--color-primary)" }}>
                {catName}
              </p>
            )}

            {/* Nombre */}
            <h1
              className="text-3xl md:text-4xl leading-tight mb-6 text-gray-900"
              style={{ fontFamily: "var(--font-display)", fontWeight: 300, letterSpacing: "-0.01em" }}
            >
              {product.name}
            </h1>

            {/* Precio */}
            <div className="flex items-baseline gap-4 mb-2">
              <span className="text-2xl text-gray-900" style={{ fontWeight: 300 }}>
                ${effectivePrice.toLocaleString("es-CO")}
              </span>
              {selectedVariant &&
                selectedVariant.price !== null &&
                Number(selectedVariant.price) !== Number(product.price) && (
                  <span className="text-base text-gray-300 line-through font-light">
                    ${Number(product.price).toLocaleString("es-CO")}
                  </span>
              )}
            </div>

            {/* Stock inline */}
            {selectedVariant && (
              <p className={`text-[10px] tracking-[0.15em] uppercase font-medium mb-6 ${
                effectiveStock > 0 ? "text-gray-400" : "text-red-400"
              }`}>
                {effectiveStock > 0 ? `${effectiveStock} en stock` : "Agotado"}
              </p>
            )}

            {/* Descripción */}
            {product.description && (
              <p className="text-sm text-gray-500 leading-relaxed font-light border-t border-gray-100 pt-5 mb-7">
                {product.description}
              </p>
            )}

            {/* ── Selector de Talla ──────────────────────────────────────── */}
            {availableSizes.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em]">Talla</h3>
                  {selectedSize && (
                    <span
                      className="text-[10px] tracking-[0.1em] uppercase font-medium"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {selectedSize}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableSizes.map((size) => {
                    const hasStock = activeVariants.some(
                      (v) => v.size === size && (!selectedColor || v.color === selectedColor) && v.stock > 0
                    );
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        id={`size-btn-${size}`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSize(null);
                            setQuantity(1);
                          } else {
                            setSelectedSize(size);
                            setQuantity(1);
                            const colorAvailable = activeVariants.some(
                              (v) => v.size === size && v.color === selectedColor && v.is_active
                            );
                            if (!colorAvailable) setSelectedColor(null);
                          }
                        }}
                        disabled={!hasStock}
                        className={`px-3 py-1.5 text-[11px] border-b transition-all duration-150 ${
                          isSelected
                            ? "text-gray-900 font-medium"
                            : !hasStock
                            ? "border-transparent text-gray-200 line-through cursor-not-allowed"
                            : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                        }`}
                        style={isSelected ? { borderColor: "var(--color-primary)" } : {}}
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
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em]">Color</h3>
                  {selectedColor && (
                    <span
                      className="text-[10px] tracking-[0.1em] uppercase font-medium"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {selectedColor}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableColors.map((color) => {
                    const hasStock = activeVariants.some(
                      (v) => v.color === color && (!selectedSize || v.size === selectedSize) && v.stock > 0
                    );
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        id={`color-btn-${color}`}
                        onClick={() => {
                          setSelectedColor(isSelected ? null : color);
                          setQuantity(1);
                        }}
                        disabled={!hasStock}
                        className={`px-3 py-1.5 text-[11px] border-b transition-all duration-150 ${
                          isSelected
                            ? "text-gray-900 font-medium"
                            : !hasStock
                            ? "border-transparent text-gray-200 line-through cursor-not-allowed"
                            : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                        }`}
                        style={isSelected ? { borderColor: "var(--color-primary)" } : {}}
                      >
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Cantidad ──────────────────────────────────────────────── */}
            {canAdd && (
              <div className="mb-7">
                <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-3">
                  Cantidad
                </h3>
                <div className="flex items-center border-b border-gray-200 w-fit">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-8 h-8 flex items-center justify-center text-gray-400
                               hover:text-gray-900 disabled:opacity-30 transition-colors"
                    id="qty-minus"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-light text-gray-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(effectiveStock, q + 1))}
                    disabled={quantity >= effectiveStock}
                    className="w-8 h-8 flex items-center justify-center text-gray-400
                               hover:text-gray-900 disabled:opacity-30 transition-colors"
                    id="qty-plus"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Acciones ──────────────────────────────────────────────── */}
            <div className="flex gap-3 pt-5 border-t border-gray-100">
              <button
                onClick={handleAddToCart}
                disabled={!canAdd}
                id="add-to-cart-btn"
                className={`flex-1 min-h-[52px] flex items-center justify-center gap-2.5
                            text-sm rounded-full transition-all ${
                  canAdd
                    ? addedFeedback
                      ? "bg-green-600 text-white"
                      : "btn-primary"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {addedFeedback ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ¡Agregado!
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" strokeWidth={1.5} />
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
                className="w-12 h-12 flex items-center justify-center border border-gray-200
                           rounded-full hover:bg-gray-50 transition-colors text-gray-400"
                aria-label="Compartir producto"
                id="share-product-btn"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* Mensaje de validación */}
            {!canAdd && activeVariants.length > 0 && (availableSizes.length > 0 || availableColors.length > 0) && (
              <p className="text-[10px] tracking-[0.1em] uppercase text-amber-500
                            flex items-center gap-1.5 mt-3">
                <AlertCircle className="w-3 h-3" />
                {availableSizes.length > 0 && !selectedSize
                  ? "Selecciona una talla para continuar"
                  : availableColors.length > 0 && !selectedColor
                  ? "Selecciona un color para continuar"
                  : ""}
              </p>
            )}

            {/* Sin variantes activas */}
            {activeVariants.length === 0 && (
              <p className="text-sm font-light text-gray-400 pt-5 border-t border-gray-100">
                Este producto no está disponible actualmente.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── También te puede gustar ──────────────────────────────────────────
          Visible mientras carga (skeleton) o cuando hay resultados.
          Estrategia: misma categoría → destacados → más recientes
      ── */}
      {(relatedLoading || related.length > 0) && (
        <section className="border-t border-gray-100 py-14 md:py-20">

          {/* Header */}
          <div className="max-w-6xl mx-auto px-6 flex items-end justify-between mb-10">
            <div>
              <p className="eyebrow mb-2" style={{ color: "var(--color-primary)" }}>
                Quizá también te guste
              </p>
              <h2
                className="text-2xl md:text-3xl text-gray-900"
                style={{ fontFamily: "var(--font-display)", fontWeight: 300, letterSpacing: "-0.01em" }}
              >
                Similares
              </h2>
            </div>
            {catId && !relatedLoading && (
              <Link
                to={`/catalogo?category=${catId}`}
                className="eyebrow text-gray-400 hover:text-gray-700 transition-colors hidden sm:block"
              >
                Ver categoría →
              </Link>
            )}
          </div>

          {/* Carrusel o skeleton */}
          <div className="max-w-6xl mx-auto">
            {relatedLoading ? (
              <CarouselSkeleton count={4} />
            ) : (
              <ProductCarousel products={related} />
            )}
          </div>

          {/* Ver categoría — solo móvil */}
          {!relatedLoading && catId && (
            <div className="sm:hidden text-center mt-6 px-6">
              <Link
                to={`/catalogo?category=${catId}`}
                className="eyebrow text-gray-500 hover:text-gray-800 transition-colors"
              >
                {catName ? `Ver más en ${catName} →` : "Ver categoría →"}
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
