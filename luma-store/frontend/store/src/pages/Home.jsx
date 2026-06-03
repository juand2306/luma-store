import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import storeClient from "../api/storeClient";
import ProductCarousel, { CarouselSkeleton } from "../components/ProductCarousel";
import { useReveal } from "../hooks/useReveal";

const TICKER = [
  "Nueva colección",
  "Envíos a toda Colombia",
  "Atención personalizada",
  "Calidad garantizada",
  "Moda con intención",
];


export default function Home({ config: configProp }) {
  const config = configProp || { name: "LUMA", primary_color: "#0D8585", banner_text: "" };

  const [categories,       setCategories]       = useState([]);
  const [featured,         setFeatured]         = useState([]);
  const [categoryProducts, setCategoryProducts] = useState({});
  const [loading,          setLoading]          = useState(true);
  const [catsLoaded,       setCatsLoaded]       = useState(false);

  const revealCategories = useReveal(0.06);
  const revealFeatured   = useReveal(0.06);
  const revealCta        = useReveal(0.1);

  useEffect(() => {
    if (config.name) document.title = `${config.name} — Tienda Online`;
  }, [config.name]);

  useEffect(() => {
    Promise.allSettled([
      storeClient.get("/store/categories/"),
      storeClient.get("/store/products/?is_featured=true&page_size=8"),
    ]).then(([catResult, featResult]) => {
      let cats = [];

      if (catResult.status === "fulfilled") {
        cats = catResult.value.data || [];
        setCategories(cats);
      }
      if (featResult.status === "fulfilled") {
        const d = featResult.value.data;
        setFeatured(Array.isArray(d) ? d : (d.results || []));
      }

      setLoading(false);

      // Fetch paralelo de productos por categoría raíz
      const roots = cats.filter((c) => !c.parent).slice(0, 6);
      Promise.allSettled(
        roots.map((cat) =>
          storeClient.get(`/store/products/?category=${cat.id}&page_size=8`)
        )
      ).then((results) => {
        const catProds = {};
        roots.forEach((cat, i) => {
          if (results[i].status === "fulfilled") {
            const d = results[i].value.data;
            catProds[cat.id] = Array.isArray(d) ? d : (d.results || []);
          }
        });
        setCategoryProducts(catProds);
        setCatsLoaded(true);
      });
    });
  }, []);

  const rootCats = categories.filter((c) => !c.parent);

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="min-h-[92vh] flex flex-col bg-[#F7F3EE] relative overflow-hidden">
        <div className="h-[3px] w-full flex-shrink-0" style={{ backgroundColor: "var(--color-primary)" }} />

        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden" aria-hidden="true">
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 900,
            fontSize: "clamp(7rem, 28vw, 22rem)", letterSpacing: "-0.04em",
            lineHeight: 1, color: "#000", opacity: 0.035,
          }}>
            {config.name || "LUMA"}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative z-10">
          <p className="eyebrow mb-8" style={{ color: "var(--color-primary)" }}>
            Nueva Colección · {new Date().getFullYear()}
          </p>

          {config.logo ? (
            <img src={config.logo} alt={config.name}
              className="h-28 sm:h-40 md:h-52 w-auto max-w-md object-contain mx-auto mb-10" />
          ) : (
            <h1 className="text-center mb-10 leading-none" style={{
              fontFamily: "var(--font-display)", fontWeight: 300,
              fontSize: "clamp(3.8rem, 13vw, 8.5rem)", letterSpacing: "-0.02em", color: "#1a1a1a",
            }}>
              {config.name || "LUMA"}
            </h1>
          )}

          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-px bg-gray-300" />
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-primary)" }} />
            <div className="w-16 h-px bg-gray-300" />
          </div>

          <p className="text-[11px] tracking-[0.28em] uppercase text-gray-500 mb-10" style={{ fontWeight: 300 }}>
            {config.banner_text || "Moda con intención · Colombia"}
          </p>

          <Link to="/catalogo"
            className="inline-flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase text-gray-800 mb-14 pb-1 border-b transition-all duration-300 hover:gap-5 hover:text-gray-900"
            style={{ borderColor: "var(--color-primary)" }} id="hero-catalog-btn">
            Explorar colección
            <ArrowRight className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
          </Link>

          {rootCats.length > 0 && (
            <div className="flex items-center flex-wrap justify-center gap-y-2">
              {rootCats.slice(0, 5).map((cat, i) => (
                <span key={cat.id} className="flex items-center">
                  <Link to={`/catalogo?category=${cat.id}`}
                    className="text-[10px] text-gray-400 hover:text-gray-700 transition-colors duration-200 px-3 tracking-[0.1em]">
                    {cat.name}
                  </Link>
                  {i < Math.min(rootCats.length, 5) - 1 && (
                    <span className="text-gray-200 text-xs leading-none">·</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Ticker */}
        <div className="border-t border-gray-200/60 py-3 overflow-hidden flex-shrink-0">
          <div className="marquee-track flex whitespace-nowrap w-max">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex items-center flex-shrink-0">
                {TICKER.map((item, i) => (
                  <span key={i} className="inline-flex items-center">
                    <span className="text-[9px] tracking-[0.25em] uppercase text-gray-400 px-8 font-medium">{item}</span>
                    <span className="text-[8px] flex-shrink-0" style={{ color: "var(--color-primary)" }}>✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categorías ──────────────────────────────────────────────────────────
          Desktop: border-grid editorial (4 cols) sin fondo agresivo
          Móvil:   carrusel horizontal de tarjetas compactas
      ── */}
      {rootCats.length > 0 && (
        <section ref={revealCategories} className="reveal max-w-7xl mx-auto px-6 py-14 md:py-16">
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="eyebrow mb-2" style={{ color: "var(--color-primary)" }}>Explorar</p>
              <h2 className="h-editorial text-2xl md:text-3xl">Categorías</h2>
            </div>
            <Link to="/catalogo"
              className="eyebrow text-gray-400 hover:text-gray-700 transition-colors hidden sm:block">
              Ver catálogo →
            </Link>
          </div>

          {/* ── Desktop: border-grid con hover de relleno y animaciones ── */}
          <div className="hidden lg:grid lg:grid-cols-4 border-t border-l border-gray-100">
            {rootCats.slice(0, 8).map((cat, i) => (
              <Link key={cat.id} to={`/catalogo?category=${cat.id}`}
                id={`category-card-${cat.id}`}
                className="group border-b border-r border-gray-100 p-7 relative overflow-hidden
                           transition-all duration-300 hover:shadow-[inset_0_0_0_1.5px_rgba(13,133,133,0.18)]"
              >
                {/* Fondo que sube desde abajo en hover */}
                <div
                  className="absolute inset-x-0 bottom-0 h-0 group-hover:h-full
                             transition-all duration-500 ease-out"
                  style={{ backgroundColor: "rgba(var(--color-primary-rgb), 0.05)" }}
                />
                {/* Acento izquierdo */}
                <div className="absolute left-0 top-0 bottom-0 w-[2px] scale-y-0
                               group-hover:scale-y-100 transition-transform duration-500 origin-bottom"
                  style={{ backgroundColor: "var(--color-primary)" }} />

                {/* Número editorial */}
                <span className="text-[9px] tracking-[0.22em] block mb-3 relative z-10"
                  style={{ color: "var(--color-primary)", fontWeight: 700 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Nombre */}
                <p className="text-xl leading-snug mb-2 text-gray-800 group-hover:text-gray-900
                             transition-colors relative z-10"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}>
                  {cat.name}
                </p>

                {cat.subcategories?.filter((s) => s.is_active !== false).length > 0 && (
                  <p className="text-[9px] text-gray-400 tracking-[0.1em] mb-4 relative z-10">
                    {cat.subcategories.filter((s) => s.is_active !== false).length} subcategorías
                  </p>
                )}

                {/* Arrow que aparece en hover */}
                <div className="flex items-center gap-2 relative z-10">
                  <div className="h-px w-0 group-hover:w-5 transition-all duration-300"
                    style={{ backgroundColor: "var(--color-primary)" }} />
                  <ArrowRight
                    className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100
                               group-hover:translate-x-0 transition-all duration-300"
                    style={{ color: "var(--color-primary)" }}
                    strokeWidth={1.5}
                  />
                </div>
              </Link>
            ))}
          </div>

          {/* ── Móvil: carrusel de tarjetas oscuras con glow ── */}
          <div className="lg:hidden">
            <div className="flex overflow-x-auto -mx-6 px-6 gap-4 pb-4 scrollbar-none snap-x snap-mandatory">
              {rootCats.slice(0, 8).map((cat, i) => (
                <Link key={cat.id} to={`/catalogo?category=${cat.id}`}
                  className="flex-none w-52 h-44 snap-start relative overflow-hidden flex flex-col
                             justify-between p-5 group
                             shadow-lg hover:shadow-xl transition-shadow duration-300"
                  style={{ background: "linear-gradient(145deg, #111111 0%, #1c1c1c 100%)" }}
                >
                  {/* Glow de color en la esquina superior derecha */}
                  <div
                    className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl
                               opacity-30 group-hover:opacity-50 transition-opacity duration-300"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  />

                  {/* Número */}
                  <span className="text-[9px] tracking-[0.25em] font-bold relative z-10"
                    style={{ color: "var(--color-primary)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Nombre + flecha */}
                  <div className="relative z-10">
                    <p className="text-white text-xl leading-tight mb-3"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}>
                      {cat.name}
                    </p>
                    {cat.subcategories?.filter((s) => s.is_active !== false).length > 0 && (
                      <p className="text-[9px] text-gray-500 tracking-[0.1em] mb-2">
                        {cat.subcategories.filter((s) => s.is_active !== false).length} subcategorías
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-gray-700" />
                      <ArrowRight
                        className="w-3.5 h-3.5 translate-x-0 group-hover:translate-x-1 transition-transform duration-200"
                        style={{ color: "var(--color-primary)" }}
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-center text-[9px] tracking-[0.2em] uppercase text-gray-300 mt-3">
              ← desliza →
            </p>
          </div>
        </section>
      )}

      {/* ── Divisor ─────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-100" />
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-primary)", opacity: 0.5 }} />
          <div className="flex-1 h-px bg-gray-100" />
        </div>
      </div>

      {/* ── Destacados ──────────────────────────────────────────────────────────
          Desktop (lg+): grid 4 columnas
          Móvil (< lg):  carrusel horizontal
      ── */}
      {!loading && featured.length > 0 && (
        <section ref={revealFeatured} className="reveal pt-14 pb-14 md:pt-16 md:pb-16">
          <div className="max-w-7xl mx-auto px-6 flex items-end justify-between mb-8">
            <div>
              <p className="eyebrow mb-2" style={{ color: "var(--color-primary)" }}>Curados para ti</p>
              <h2 className="h-editorial text-2xl md:text-3xl">Destacados</h2>
            </div>
            <Link to="/catalogo"
              className="eyebrow text-gray-400 hover:text-gray-700 transition-colors hidden sm:block">
              Ver todo →
            </Link>
          </div>
          <div className="max-w-7xl mx-auto">
            <ProductCarousel products={featured} />
          </div>
        </section>
      )}

      {/* ── Secciones por categoría ─────────────────────────────────────────────
          Una sección por cada categoría raíz que tenga productos.
          Desktop: grid 4 col | Móvil: carrusel horizontal
      ── */}
      {rootCats.map((cat) => {
        const products = categoryProducts[cat.id];
        // Categoría cargada y sin productos → omitir
        if (catsLoaded && (!products || products.length === 0)) return null;

        return (
          <section key={cat.id} className="border-t border-gray-100 py-14 md:py-16">
            {/* Header */}
            <div className="max-w-7xl mx-auto px-6 flex items-end justify-between mb-8">
              <div>
                {products && (
                  <p className="eyebrow mb-1.5" style={{ color: "var(--color-primary)" }}>
                    {products.length} piezas
                  </p>
                )}
                <h2 className="h-editorial text-2xl md:text-3xl">{cat.name}</h2>
                {cat.subcategories?.filter((s) => s.is_active !== false).length > 0 && (
                  <p className="text-[10px] text-gray-400 tracking-[0.12em] mt-1">
                    {cat.subcategories
                      .filter((s) => s.is_active !== false)
                      .map((s) => s.name)
                      .slice(0, 4)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <Link to={`/catalogo?category=${cat.id}`}
                className="eyebrow text-gray-400 hover:text-gray-700 transition-colors hidden sm:block">
                Ver todo →
              </Link>
            </div>

            {/* Carrusel / Skeleton */}
            <div className="max-w-7xl mx-auto">
              {!products ? <CarouselSkeleton /> : <ProductCarousel products={products} />}
            </div>

            {/* Ver todo — solo móvil */}
            <div className="sm:hidden text-center mt-5 px-6">
              <Link to={`/catalogo?category=${cat.id}`}
                className="eyebrow text-gray-500 hover:text-gray-800 transition-colors">
                Ver todo en {cat.name} →
              </Link>
            </div>
          </section>
        );
      })}

      {/* ── CTA WhatsApp ────────────────────────────────────────────────────── */}
      {config.whatsapp && (
        <section ref={revealCta} className="reveal relative overflow-hidden bg-[#0F0F0F] py-24 px-6">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden" aria-hidden="true">
            <span style={{
              fontFamily: "var(--font-display)", fontWeight: 900,
              fontSize: "clamp(5rem, 20vw, 16rem)", letterSpacing: "-0.04em",
              color: "#fff", opacity: 0.025,
            }}>
              LUMA
            </span>
          </div>
          <div className="max-w-lg mx-auto text-center relative z-10">
            <p className="eyebrow text-gray-600 mb-6">Atención al cliente</p>
            <h2 className="text-3xl md:text-4xl text-white mb-4 leading-tight"
              style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}>
              ¿Tienes alguna pregunta?
            </h2>
            <p className="text-gray-500 text-sm font-light mb-10 leading-relaxed">
              Escríbenos por WhatsApp. Con gusto te atendemos.
            </p>
            <a href={`https://wa.me/${config.whatsapp.replace(/\D/g, "")}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-white text-[11px] tracking-[0.18em] uppercase border-b pb-1 hover:opacity-80 transition-opacity duration-200"
              style={{ borderColor: "var(--color-primary)" }} id="contact-whatsapp-btn">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Contáctanos por WhatsApp
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
