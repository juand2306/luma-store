import ProductCard from "./ProductCard";

/**
 * ProductCarousel — Componente compartido para carruseles de productos.
 *
 * Móvil  (< lg): scroll horizontal con snap, tarjetas a 68vw
 * Desktop (lg+): grid de N columnas (default 4)
 */
export default function ProductCarousel({ products, cols = 4 }) {
  if (!products || products.length === 0) return null;

  const colClass =
    cols === 3
      ? "lg:grid-cols-3"
      : cols === 5
      ? "lg:grid-cols-5"
      : "lg:grid-cols-4";

  return (
    <div>
      <div
        className={[
          "flex overflow-x-auto px-6 gap-5 pb-5 scrollbar-none snap-x snap-mandatory",
          `lg:grid lg:gap-6 lg:overflow-visible lg:pb-0 lg:snap-none lg:px-6 ${colClass}`,
        ].join(" ")}
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="flex-none w-[68vw] sm:w-[44vw] snap-start lg:w-auto"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
      <p className="lg:hidden text-center text-[9px] tracking-[0.2em] uppercase text-gray-300 mt-2 px-6">
        ← desliza →
      </p>
    </div>
  );
}

/**
 * CarouselSkeleton — Placeholder animado mientras cargan los productos.
 */
export function CarouselSkeleton({ count = 4 }) {
  return (
    <div className="flex overflow-x-auto px-6 gap-5 pb-5 scrollbar-none lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:pb-0 lg:px-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-none w-[68vw] sm:w-[44vw] lg:w-auto animate-pulse">
          <div className="aspect-[3/4] bg-gray-100 mb-3" />
          <div className="h-2 bg-gray-100 rounded w-1/3 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
          <div className="h-2.5 bg-gray-100 rounded w-1/4" />
        </div>
      ))}
    </div>
  );
}
