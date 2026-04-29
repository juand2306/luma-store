import { useState, useEffect } from "react";
import { X, SlidersHorizontal } from "lucide-react";
import storeClient from "../api/storeClient";

/**
 * FilterPanel — Panel de filtros para el catálogo.
 * En móvil es un drawer oculto que se activa con "Filtrar".
 * En escritorio es una columna lateral permanente.
 *
 * @param {Object} filters - Estado actual de los filtros
 * @param {Function} onChange - Callback para actualizar filtros
 */
export default function FilterPanel({ filters, onChange }) {
  const [categories, setCategories] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 500000 });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    storeClient.get("/store/categories/").then((r) => setCategories(r.data)).catch(() => {});
    // Obtener tallas y colores únicos de productos visibles
    storeClient.get("/store/products/?page_size=200").then((r) => {
      const products = Array.isArray(r.data) ? r.data : (r.data.results || []);
      const allSizes = new Set();
      const allColors = new Set();
      let maxPrice = 0;
      products.forEach((p) => {
        if (Number(p.price) > maxPrice) maxPrice = Number(p.price);
        p.variants?.forEach((v) => {
          if (v.size) allSizes.add(v.size);
          if (v.color) allColors.add(v.color);
        });
      });
      setSizes([...allSizes].sort());
      setColors([...allColors].sort());
      if (maxPrice > 0) setPriceRange({ min: 0, max: maxPrice });
    }).catch(() => {});
  }, []);

  const handleCategory = (id) => {
    const current = filters.categories || [];
    const updated = current.includes(id)
      ? current.filter((c) => c !== id)
      : [...current, id];
    onChange({ ...filters, categories: updated });
  };

  const handleSize = (size) => {
    const current = filters.sizes || [];
    const updated = current.includes(size)
      ? current.filter((s) => s !== size)
      : [...current, size];
    onChange({ ...filters, sizes: updated });
  };

  const handleColor = (color) => {
    const current = filters.colors || [];
    const updated = current.includes(color)
      ? current.filter((c) => c !== color)
      : [...current, color];
    onChange({ ...filters, colors: updated });
  };

  const handlePriceMax = (v) => onChange({ ...filters, max_price: Number(v) });

  const handleAvailable = (e) => onChange({ ...filters, only_available: e.target.checked });

  const clearAll = () =>
    onChange({ categories: [], sizes: [], colors: [], max_price: priceRange.max, only_available: false });

  const hasFilters =
    (filters.categories?.length > 0) ||
    (filters.sizes?.length > 0) ||
    (filters.colors?.length > 0) ||
    filters.only_available;

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Filtros</h2>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-blue-600 hover:underline"
            id="filter-clear-btn"
          >
            Limpiar todo
          </button>
        )}
      </div>

      {/* Solo disponibles */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.only_available || false}
          onChange={handleAvailable}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          id="filter-available"
        />
        <span className="text-sm text-gray-700">Solo disponibles</span>
      </label>

      {/* Categorías */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Categoría
          </h3>
          <div className="space-y-1">
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(filters.categories || []).includes(cat.id)}
                  onChange={() => handleCategory(cat.id)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  id={`filter-cat-${cat.id}`}
                />
                <span className="text-sm text-gray-700">{cat.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Tallas */}
      {sizes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Talla
          </h3>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => (
              <button
                key={size}
                onClick={() => handleSize(size)}
                id={`filter-size-${size}`}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  (filters.sizes || []).includes(size)
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Colores */}
      {colors.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Color
          </h3>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => handleColor(color)}
                id={`filter-color-${color}`}
                title={color}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  (filters.colors || []).includes(color)
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Precio */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Precio máximo
        </h3>
        <div className="space-y-2">
          <input
            type="range"
            min={priceRange.min}
            max={priceRange.max}
            step={5000}
            value={filters.max_price ?? priceRange.max}
            onChange={(e) => handlePriceMax(e.target.value)}
            className="w-full h-2 rounded-lg appearance-none bg-gray-200 accent-blue-600"
            id="filter-price-range"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>$0</span>
            <span className="font-semibold text-blue-600">
              ${(filters.max_price ?? priceRange.max).toLocaleString("es-CO")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Botón móvil */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 bg-white shadow-sm"
          id="filter-mobile-btn"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtrar
          {hasFilters && (
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
              {(filters.categories?.length || 0) +
                (filters.sizes?.length || 0) +
                (filters.colors?.length || 0) +
                (filters.only_available ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-4/5 max-w-xs bg-white p-6 overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold text-gray-900">Filtros</span>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {content}
            <button
              onClick={() => setMobileOpen(false)}
              className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl font-medium"
            >
              Ver productos
            </button>
          </div>
        </div>
      )}

      {/* Panel escritorio */}
      <div className="hidden lg:block sticky top-20 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {content}
      </div>
    </>
  );
}
