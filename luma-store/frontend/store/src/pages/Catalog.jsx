import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SortAsc, SortDesc, Loader2, ShoppingBag } from "lucide-react";
import storeClient from "../api/storeClient";
import ProductCard from "../components/ProductCard";
import FilterPanel from "../components/FilterPanel";

const PAGE_SIZE = 20;

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchText);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("name");

  const [filters, setFilters] = useState({
    categories: searchParams.get("category") ? [Number(searchParams.get("category"))] : [],
    sizes: [],
    colors: [],
    max_price: undefined,
    only_available: false,
  });

  useEffect(() => {
    document.title = "Catálogo — LUMA Store";
  }, []);

  // Debounce de búsqueda
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
      if (filters.categories?.length) params.set("category", filters.categories.join(","));
      if (filters.max_price) params.set("max_price", filters.max_price);

      const res = await storeClient.get(`/store/products/?${params}`);
      let data = res.data;
      let results = Array.isArray(data) ? data : (data.results || []);
      let total = Array.isArray(data) ? data.length : (data.count || results.length);

      // Filtros del lado cliente (tallas, colores, disponibilidad) que el backend puede no soportar
      if (filters.sizes?.length) {
        results = results.filter((p) =>
          p.variants?.some((v) => filters.sizes.includes(v.size) && v.is_active)
        );
      }
      if (filters.colors?.length) {
        results = results.filter((p) =>
          p.variants?.some((v) => filters.colors.includes(v.color) && v.is_active)
        );
      }
      if (filters.only_available) {
        results = results.filter((p) =>
          p.variants?.some((v) => v.stock > 0 && v.is_active)
        );
      }

      setProducts(results);
      setCount(total);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, page, ordering]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Título */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Catálogo</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {count > 0 ? `${count} productos encontrados` : "Explora todos nuestros productos"}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Panel de filtros — columna izquierda */}
        <aside className="lg:w-64 flex-shrink-0">
          <FilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
        </aside>

        {/* Productos — área derecha */}
        <main className="flex-1 min-w-0">
          {/* Barra de búsqueda y ordenamiento */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar por nombre o referencia..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                id="catalog-search"
              />
            </div>

            <select
              value={ordering}
              onChange={(e) => { setOrdering(e.target.value); setPage(1); }}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              id="catalog-sort"
            >
              <option value="name">Nombre A–Z</option>
              <option value="-name">Nombre Z–A</option>
              <option value="price">Precio: menor a mayor</option>
              <option value="-price">Precio: mayor a menor</option>
              <option value="-created_at">Más recientes</option>
            </select>
          </div>

          {/* Grid de productos */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <ShoppingBag className="w-16 h-16 mb-4 opacity-30" />
              <p className="font-medium text-gray-500">No encontramos productos</p>
              <p className="text-sm mt-1">Prueba con otros términos o quita los filtros</p>
              <button
                onClick={() => {
                  setSearchText("");
                  setFilters({ categories: [], sizes: [], colors: [], max_price: undefined, only_available: false });
                }}
                className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
                    id="pagination-prev"
                  >
                    ← Anterior
                  </button>
                  <span className="text-sm text-gray-600 px-3">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
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
  );
}
