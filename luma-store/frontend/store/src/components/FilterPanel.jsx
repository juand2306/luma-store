import { useState, useEffect, useRef } from "react";
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
  const [localPrice, setLocalPrice] = useState(filters.max_price ?? 500000);
  const priceDebounceRef = useRef(null);

  useEffect(() => {
    // Categorías y opciones de filtro en paralelo (2 requests en vez de 200-product dump)
    Promise.all([
      storeClient.get("/store/categories/").catch(() => ({ data: [] })),
      storeClient.get("/store/products/filter-options/").catch(() => ({ data: {} })),
    ]).then(([catRes, optsRes]) => {
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      const opts = optsRes.data || {};
      if (opts.sizes)  setSizes(opts.sizes);
      if (opts.colors) setColors(opts.colors);
      if (opts.max_price > 0) {
        setPriceRange({ min: 0, max: opts.max_price });
        setLocalPrice((prev) => prev === 500000 ? opts.max_price : prev);
      }
    });
  }, []);

  // Selección única de categoría: clic en la misma → deselecciona; clic en otra → la selecciona sola
  const handleCategory = (id) => {
    const current = filters.categories || [];
    const updated = current.includes(id) ? [] : [id];
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

  const handlePriceMax = (v) => {
    const val = Number(v);
    setLocalPrice(val);
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    priceDebounceRef.current = setTimeout(() => {
      onChange({ ...filters, max_price: val });
    }, 400);
  };

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
        <h2 className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em]">Filtros</h2>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-[10px] tracking-[0.1em] uppercase text-gray-500 border-b border-gray-300
                       pb-0.5 hover:text-gray-900 hover:border-gray-900 transition-colors"
            id="filter-clear-btn"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Solo disponibles */}
      <label className="flex items-center gap-2.5 cursor-pointer group">
        <input
          type="checkbox"
          checked={filters.only_available || false}
          onChange={handleAvailable}
          className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus:ring-0 focus:ring-offset-0"
          style={{ accentColor: 'var(--color-primary)' }}
          id="filter-available"
        />
        <span className="text-sm font-light text-gray-600 group-hover:text-gray-900 transition-colors">
          Solo disponibles
        </span>
      </label>

      {/* Categorías */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-3">
            Categoría
          </h3>
          <div className="space-y-0.5">
            {/* Solo categorías raíz en el nivel superior */}
            {categories.filter(c => !c.parent).map((cat) => {
              const subs = Array.isArray(cat.subcategories)
                ? cat.subcategories.filter((s) => s.is_active !== false)
                : [];
              const isSelected = (filters.categories || []).includes(cat.id);
              return (
                <div key={cat.id}>
                  {/* Categoría raíz */}
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="radio"
                      name="store-category"
                      checked={isSelected}
                      onChange={() => handleCategory(cat.id)}
                      onClick={() => isSelected && handleCategory(cat.id)}
                      className="w-4 h-4 border-gray-300 focus:ring-0"
                      style={{ accentColor: 'var(--color-primary)' }}
                      id={`filter-cat-${cat.id}`}
                    />
                    <span className="text-sm font-light text-gray-700">{cat.name}</span>
                  </label>
                  {/* Subcategorías — siempre visibles, indentadas */}
                  {subs.length > 0 && (
                    <div className="ml-5 space-y-0.5">
                      {subs.map((sub) => {
                        const isSubSelected = (filters.categories || []).includes(sub.id);
                        return (
                          <label key={sub.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="radio"
                              name="store-category"
                              checked={isSubSelected}
                              onChange={() => handleCategory(sub.id)}
                              onClick={() => isSubSelected && handleCategory(sub.id)}
                              className="w-3.5 h-3.5 border-gray-300 focus:ring-0"
                              style={{ accentColor: 'var(--color-primary)' }}
                              id={`filter-cat-${sub.id}`}
                            />
                            <span className="text-xs text-gray-600">{sub.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tallas */}
      {sizes.length > 0 && (
        <div>
          <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-3">
            Talla
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {sizes.map((size) => {
              const selected = (filters.sizes || []).includes(size);
              return (
                <button
                  key={size}
                  onClick={() => handleSize(size)}
                  id={`filter-size-${size}`}
                  className={`px-2.5 py-1 text-[11px] border-b transition-colors duration-150 ${
                    selected
                      ? "border-gray-900 text-gray-900 font-medium"
                      : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Colores */}
      {colors.length > 0 && (
        <div>
          <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-3">
            Color
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {colors.map((color) => {
              const selected = (filters.colors || []).includes(color);
              return (
                <button
                  key={color}
                  onClick={() => handleColor(color)}
                  id={`filter-color-${color}`}
                  title={color}
                  className={`text-[11px] border-b transition-colors duration-150 px-1.5 py-1 ${
                    selected
                      ? "border-gray-900 text-gray-900 font-medium"
                      : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {color}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Precio */}
      <div>
        <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-3">
          Precio máximo
        </h3>
        <div className="space-y-3">
          <input
            type="range"
            min={priceRange.min}
            max={priceRange.max}
            step={5000}
            value={localPrice}
            onChange={(e) => handlePriceMax(e.target.value)}
            className="w-full h-0.5 rounded-none appearance-none bg-gray-200"
            style={{ accentColor: 'var(--color-primary)' }}
            id="filter-price-range"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span className="font-light">$0</span>
            <span className="font-medium text-gray-800">
              ${localPrice.toLocaleString("es-CO")}
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
            <span
              className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
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
              className="mt-6 w-full py-3 text-white rounded-xl font-medium text-sm tracking-wide transition-all"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Ver productos
            </button>
          </div>
        </div>
      )}

      {/* Panel escritorio */}
      <div className="hidden lg:block sticky top-24 p-0">
        {content}
      </div>
    </>
  );
}
