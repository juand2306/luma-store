import { Link } from "react-router-dom";
import { ShoppingCart, Eye, Star } from "lucide-react";
import { useCart } from "../context/CartContext";

/**
 * ProductCard — Tarjeta de producto para listados y cuadrículas.
 * @param {Object} product - Producto con variants, images, name, price, etc.
 */
export default function ProductCard({ product }) {
  const { addItem, openCart } = useCart();

  const mainImage =
    product.images?.find((img) => img.is_main)?.image ||
    product.images?.[0]?.image ||
    product.main_image ||
    null;

  // Usar total_stock del servidor (ya filtrado a variantes activas)
  const totalStock = product.total_stock ?? product.variants?.reduce((acc, v) => acc + (v.is_active !== false ? v.stock : 0), 0) ?? 0;
  const firstAvailableVariant = product.variants?.find((v) => v.stock > 0 && v.is_active !== false);
  const isOutOfStock = totalStock === 0;

  const price = Number(product.price);

  const handleQuickAdd = (e) => {
    e.preventDefault();
    if (!firstAvailableVariant) return;
    addItem({
      variant_id: firstAvailableVariant.id,
      product_id: product.id,
      product_name: product.name,
      size: firstAvailableVariant.size,
      color: firstAvailableVariant.color,
      unit_price: Number(firstAvailableVariant.effective_price ?? firstAvailableVariant.price ?? product.price),
      quantity: 1,
      max_stock: firstAvailableVariant.stock,
      image: mainImage,
    });
    openCart();
  };

  return (
    <Link
      to={`/producto/${product.id}`}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col"
      id={`product-card-${product.id}`}
    >
      {/* Imagen */}
      <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
        {mainImage ? (
          <img
            src={mainImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
            <svg className="w-16 h-16 mb-2" fill="none" viewBox="0 0 48 48">
              <rect x="4" y="4" width="40" height="40" rx="8" stroke="currentColor" strokeWidth="2" />
              <circle cx="24" cy="20" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M8 44c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-xs">Sin imagen</span>
          </div>
        )}

        {/* Badge Agotado */}
        {isOutOfStock && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            Agotado
          </div>
        )}

        {/* Badge destacado */}
        {product.is_featured && !isOutOfStock && (
          <div className="absolute top-3 left-3 bg-amber-400 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Star size={10} />
            Destacado
          </div>
        )}

        {/* Overlay de acciones */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
          <span className="flex items-center gap-1 bg-white text-gray-800 text-sm font-medium px-4 py-2 rounded-full shadow-lg">
            <Eye className="w-4 h-4" />
            Ver
          </span>
          {!isOutOfStock && firstAvailableVariant && (
            <button
              onClick={handleQuickAdd}
              className="flex items-center gap-1 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition"
            >
              <ShoppingCart className="w-4 h-4" />
              Agregar
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1 flex-1">
        {product.category?.name && (
          <span className="text-xs text-blue-500 font-medium uppercase tracking-wide">
            {product.category.name}
          </span>
        )}
        <h3 className="text-gray-900 font-semibold text-sm leading-tight line-clamp-2">
          {product.name}
        </h3>
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-gray-900 font-bold text-lg">
            ${price.toLocaleString("es-CO")}
          </span>
          {!isOutOfStock && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              Disponible
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
