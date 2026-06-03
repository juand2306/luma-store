import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, ShoppingBag, SlidersHorizontal } from "lucide-react";
import storeClient from "../api/storeClient";
import ProductCard from "../components/ProductCard";
import FilterPanel from "../components/FilterPanel";

const PAGE_SIZE = 12;

// ── Skeleton de tarjeta (3:4 ratio) ──────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[3/4] bg-gray-100 mb-3" />
      <div className="h-2 bg-gray-100 rounded-sm w-1/3 mb-2" />
      <div className="h-3 bg-gray-100 rounded-sm w-2/3 mb-2" />
      <div className="h-2.5 bg-gray-100 rounded-sm w-1/4" />
    </div>
  );
}

export default function Catalog() {
  const [searchParams] = useSearchParams();

  const [products,       setProducts]       = useState([]);
  const [count,          setCount]          = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [searchText,     setSearchText]     = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchText);
  const [page,           setPage]           = useState(1);
  const [ordering,       setOrdering]       = useState("name");

  const [filters, setFilters] = useState({
    categories:     searchParams.get("category") ? [Number(searchParams.get("category"))] : [],
    sizes:          [],
    colors:         [],
    max_price:      undefined,
    only_available: false,
  });

  useEffect(() => {
    document.title = "Catálogo — LUMA Store";
  }, []);

  // Debounce búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page_size", PAGE_SIZE);
      params.set("page", page);
      params.set("ordering", ordering);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.categories?.length) params.set("category", filters.categories[0]);
      filters.sizes?.forEach((s)  => params.append("size", s));
      filters.colors?.forEach((c) => params.append("color", c));
      if (filters.only_available) params.set("available", "true");
      if (filters.max_price)      params.set("max_price", filters.max_price);

      const res     = await storeClient.get(`/store/products/?${params}`);
      const data    = res.data;
      const results = Array.isArray(data) ? data : (data.results || []);
      const total   = Array.isArray(data) ? data.length : (data.count || results.length);

      setProducts(results);
      setCount(total);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, page, ordering]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const totalPages = Math.ceil(count / PAGE_SIZE);

  const clearAll = () => {
    setSearchText("");
    setFilters({ categories: [], sizes: [], colors: [], max_price: undefined, only_available: false });
    setPage(1);
  };

  const hasActiveFilters =
    filters.categories?.length > 0 ||
    filters.sizes?.length > 0 ||
    filters.colors?.length > 0 ||
    filters.only_available;

  return (
    <div>
      {/* ── Header editorial del catálogo ────────────────────────────────────── */}
      <div className="border-b border-gray-100 bg-[#FAFAF8]">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-8">
          <p className="eyebrow mb-2" style={{ color: "var(--color-primary)" }}>Tienda</p>
          <div className="flex items-end justify-between">
            <h1
              className="text-3xl md:text-4xl text-gray-900"
              style={{ fontFamily: "var(--font-display)", fontWeight: 300, letterSpacing: "-0.01em" }}
            >
              Catálogo
            </h1>
            {count > 0 && !loading && (
              <span
                className="text-[10px] tracking-[0.15em] uppercase font-medium pb-1"
                style={{ color: "var(--color-primary)" }}
              >
                {count} producto{count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenido principal ───────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row gap-10">

          {/* Panel de filtros */}
          <aside className="lg:w-52 flex-shrink-0">
            <FilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
          </aside>

          {/* Área de productos */}
          <main className="flex-1 min-w-0">

            {/* Toolbar: búsqueda + orden */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8 pb-6 border-b border-gray-100">
              {/* Búsqueda */}
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-9 pr-4 py-2.5 border-b border-gray-200 bg-transparent
                             text-sm text-gray-800 placeholder-gray-300
                             focus:outline-none focus:border-gray-800 transition-colors"
                  id="catalog-search"
                />
              </div>

              {/* Ordenar */}
              <select
                value={ordering}
                onChange={(e) => { setOrdering(e.target.value); setPage(1); }}
                className="px-0 py-2.5 border-b border-gray-200 bg-transparent
                           text-[11px] tracking-[0.1em] uppercase text-gray-500
                           focus:outline-none focus:border-gray-800 transition-colors
                           cursor-pointer"
                id="catalog-sort"
              >
                <option value="name">Nombre A–Z</option>
                <option value="-name">Nombre Z–A</option>
                <option value="price">Menor precio</option>
                <option value="-price">Mayor precio</option>
                <option value="-created_at">Más recientes</option>
              </select>
            </div>

            {/* Filtros activos — chips */}
            {hasActiveFilters && (
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <span className="text-[9px] tracking-[0.15em] uppercase text-gray-400">Filtros:</span>
                {filters.categories?.length > 0 && (
                  <span
                    className="text-[10px] tracking-[0.1em] uppercase px-3 py-1 border"
                    style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                  >
                    Categoría seleccionada
                  </span>
                )}
                {filters.sizes?.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] tracking-[0.1em] uppercase px-3 py-1 border"
                    style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                  >
                    {s}
                  </span>
                ))}
                {filters.colors?.map((c) => (
                  <span
                    key={c}
                    className="text-[10px] tracking-[0.1em] uppercase px-3 py-1 border"
                    style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                  >
                    {c}
                  </span>
                ))}
                {filters.only_available && (
                  <span
                    className="text-[10px] tracking-[0.1em] uppercase px-3 py-1 border"
                    style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                  >
                    Disponibles
                  </span>
                )}
                <button
                  onClick={clearAll}
                  className="text-[9px] tracking-[0.12em] uppercase text-gray-400
                             hover:text-gray-700 transition-colors ml-1"
                >
                  × Limpiar
                </button>
              </div>
            )}

            {/* Grid / Carrusel de productos */}
            {loading ? (
              /* Skeleton: 2 col en móvil, 3 col en desktop */
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : products.length === 0 ? (
              /* Estado vacío */
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <ShoppingBag className="w-10 h-10 text-gray-200 mb-5" strokeWidth={1} />
                <p
                  className="text-2xl text-gray-700 mb-2"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}
                >
                  Sin resultados
                </p>
                <p className="text-sm text-gray-400 font-light mb-10">
                  Prueba con otros términos o quita los filtros
                </p>
                <button
                  onClick={clearAll}
                  className="text-[11px] tracking-[0.15em] uppercase border-b pb-0.5 transition-colors"
                  style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-8">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Paginación — minimal */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-6 mt-16">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="text-[11px] tracking-[0.12em] uppercase text-gray-500
                                 border-b border-gray-300 pb-0.5 disabled:opacity-30
                                 hover:text-gray-900 hover:border-gray-900 transition-colors"
                      id="pagination-prev"
                    >
                      ← Anterior
                    </button>
                    <span className="text-xs text-gray-400 font-light">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="text-[11px] tracking-[0.12em] uppercase text-gray-500
                                 border-b border-gray-300 pb-0.5 disabled:opacity-30
                                 hover:text-gray-900 hover:border-gray-900 transition-colors"
                      id="pagination-next"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
