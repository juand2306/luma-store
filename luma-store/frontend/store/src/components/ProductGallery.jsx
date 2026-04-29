import { useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

/**
 * ProductGallery — Galería de imágenes navegable con imagen principal y thumbnails.
 * @param {Array} images - Array de {id, image, order, is_main}
 * @param {string} productName - Nombre del producto (para alt)
 */
export default function ProductGallery({ images = [], productName = "" }) {
  const sorted = [...images].sort((a, b) => {
    if (a.is_main && !b.is_main) return -1;
    if (!a.is_main && b.is_main) return 1;
    return (a.order || 0) - (b.order || 0);
  });

  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const prev = () => setCurrent((c) => (c === 0 ? sorted.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === sorted.length - 1 ? 0 : c + 1));

  if (sorted.length === 0) {
    return (
      <div className="aspect-square bg-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-300">
        <svg className="w-20 h-20 mb-3" fill="none" viewBox="0 0 48 48">
          <rect x="4" y="4" width="40" height="40" rx="8" stroke="currentColor" strokeWidth="2" />
          <circle cx="24" cy="20" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M8 44c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-sm">Sin imágenes</span>
      </div>
    );
  }

  const currentImage = sorted[current];

  return (
    <div className="space-y-4">
      {/* Imagen principal */}
      <div className="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden group cursor-zoom-in"
        onClick={() => setZoomed(true)}>
        <img
          src={currentImage.image}
          alt={`${productName} - imagen ${current + 1}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {/* Botón zoom */}
        <div className="absolute top-3 right-3 bg-black/40 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition">
          <ZoomIn className="w-4 h-4" />
        </div>

        {/* Navegación si hay más de 1 imagen */}
        {sorted.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition"
              aria-label="Imagen siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            {/* Indicadores */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {sorted.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === current ? "bg-white w-5" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img, i) => (
            <button
              key={img.id || i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                i === current ? "border-blue-600 ring-2 ring-blue-300" : "border-transparent hover:border-gray-300"
              }`}
            >
              <img
                src={img.image}
                alt={`Thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Modal de zoom */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomed(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <img
              src={currentImage.image}
              alt={productName}
              className="w-full h-auto max-h-[85vh] object-contain rounded-2xl"
            />
            <button
              onClick={() => setZoomed(false)}
              className="absolute top-3 right-3 bg-white/20 text-white p-2 rounded-full hover:bg-white/30 transition"
            >
              ✕
            </button>
            {sorted.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prev(); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/20 text-white p-3 rounded-full hover:bg-white/30 transition"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); next(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 text-white p-3 rounded-full hover:bg-white/30 transition"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
