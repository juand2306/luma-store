import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

/**
 * ProductCard — Tarjeta editorial sin borde ni sombra.
 * Hover: cross-fade a segunda imagen + barra "Agregar" que sube desde abajo.
 */
export default function ProductCard({ product }) {
  const { addItem, openCart } = useCart();

  // Imágenes
  const allImages   = product.images || [];
  const mainImage   =
    allImages.find((img) => img.is_main)?.image ||
    allImages[0]?.image ||
    product.main_image ||
    null;
  // Segunda imagen para cross-fade
  const secondImage =
    allImages.find((img) => img.image && img.image !== mainImage)?.image || null;

  // Stock
  const totalStock =
    product.total_stock ??
    product.variants?.reduce(
      (acc, v) => acc + (v.is_active !== false ? v.stock : 0),
      0
    ) ?? 0;
  const firstAvailableVariant = product.variants?.find(
    (v) => v.stock > 0 && v.is_active !== false
  );
  const isOutOfStock = totalStock === 0;
  const price = Number(product.price);

  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firstAvailableVariant) return;
    addItem({
      variant_id:   firstAvailableVariant.id,
      product_id:   product.id,
      product_name: product.name,
      size:         firstAvailableVariant.size,
      color:        firstAvailableVariant.color,
      unit_price:   Number(
        firstAvailableVariant.effective_price ??
        firstAvailableVariant.price ??
        product.price
      ),
      quantity:  1,
      max_stock: firstAvailableVariant.stock,
      image:     mainImage,
    });
    openCart();
  };

  return (
    <Link
      to={`/producto/${product.id}`}
      className="group relative flex flex-col"
      id={`product-card-${product.id}`}
    >
      {/* ── Imagen ── */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
        {mainImage ? (
          <>
            {/* Imagen principal — cross-fade en hover (desktop) / auto (móvil) */}
            <img
              src={mainImage}
              alt={product.name}
              className={`absolute inset-0 w-full h-full object-cover img-main-crossfade ${
                secondImage ? "has-second-img group-hover:opacity-0" : ""
              }`}
              loading="lazy"
            />
            {/* Segunda imagen — fade in en hover (desktop) / auto-animado (móvil) */}
            {secondImage && (
              <img
                src={secondImage}
                alt={`${product.name} — detalle`}
                className="absolute inset-0 w-full h-full object-cover
                           img-secondary-crossfade group-hover:opacity-100"
                loading="lazy"
              />
            )}
          </>
        ) : (
          /* Placeholder sin imagen */
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-200">
            <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 48 48">
              <rect x="4" y="4" width="40" height="40" rx="4" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="24" cy="20" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 44c0-8.837 7.163-16 16-16s16 7.163 16 16"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] tracking-wide text-gray-300">Sin imagen</span>
          </div>
        )}

        {/* Badge Agotado */}
        {isOutOfStock && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm
                          text-gray-500 text-[9px] tracking-[0.12em] uppercase px-2 py-1">
            Agotado
          </div>
        )}

        {/* Badge Nuevo — si tiene menos de 30 días */}
        {!isOutOfStock && product.created_at && (
          (() => {
            const days = (Date.now() - new Date(product.created_at)) / 86400000;
            return days < 30 ? (
              <div
                className="absolute top-3 right-3 text-white text-[9px] tracking-[0.12em] uppercase px-2 py-1"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Nuevo
              </div>
            ) : null;
          })()
        )}

        {/* Barra Quick-add — sube desde el fondo */}
        {!isOutOfStock && firstAvailableVariant && (
          <button
            onClick={handleQuickAdd}
            className="absolute bottom-0 left-0 right-0
                       py-3.5 text-center text-[10px] tracking-[0.18em] uppercase
                       font-medium text-white
                       translate-y-full group-hover:translate-y-0
                       transition-transform duration-300 ease-out"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Agregar al carrito
          </button>
        )}
      </div>

      {/* ── Info ── */}
      <div className="pt-3 pb-1">
        {product.category_name && (
          <p
            className="text-[9px] tracking-[0.18em] uppercase mb-1.5"
            style={{ fontWeight: 500, color: "var(--color-primary)", opacity: 0.8 }}
          >
            {product.category_name}
          </p>
        )}
        <h3
          className="text-gray-800 text-sm leading-snug mb-1.5"
          style={{ fontWeight: 300 }}
        >
          {product.name}
        </h3>
        <p
          className="text-sm"
          style={{ fontWeight: 400, color: "var(--color-primary)" }}
        >
          ${price.toLocaleString("es-CO")}
        </p>
      </div>
    </Link>
  );
}
