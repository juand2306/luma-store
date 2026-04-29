import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShoppingBag, Tag, Sparkles } from "lucide-react";
import storeClient from "../api/storeClient";
import ProductCard from "../components/ProductCard";

export default function Home() {
  const [config, setConfig] = useState({ name: "LUMA Store", primary_color: "#2E86C1", banner_text: "" });
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = `${config.name} — Tienda Online`;
  }, [config.name]);

  useEffect(() => {
    Promise.all([
      storeClient.get("/store/config/"),
      storeClient.get("/store/categories/"),
      storeClient.get("/store/products/?is_featured=true&page_size=8"),
    ])
      .then(([configRes, catRes, featRes]) => {
        setConfig(configRes.data);
        setCategories(catRes.data || []);
        const prodData = featRes.data;
        setFeatured(Array.isArray(prodData) ? prodData : (prodData.results || []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const primaryColor = config.primary_color || "#2E86C1";

  return (
    <div>
      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-20 px-4"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 60%, ${primaryColor}44 100%)`,
        }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 rounded-full bg-white" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 text-white text-sm px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            <span>Colección disponible ahora</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-4 leading-tight">
            {config.banner_text || `Bienvenido a ${config.name}`}
          </h1>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Descubre nuestra selección de ropa y accesorios. Calidad y estilo en cada pieza.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/catalogo"
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 font-bold px-8 py-3.5 rounded-full text-sm hover:bg-gray-100 transition shadow-xl"
              id="hero-catalog-btn"
            >
              <ShoppingBag className="w-5 h-5" />
              Ver catálogo completo
            </Link>
            <Link
              to="/catalogo?is_featured=true"
              className="inline-flex items-center justify-center gap-2 bg-white/20 text-white font-bold px-8 py-3.5 rounded-full text-sm hover:bg-white/30 transition backdrop-blur-sm border border-white/30"
              id="hero-featured-btn"
            >
              Destacados
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Categorías ──────────────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-14">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">Categorías</h2>
              <p className="text-gray-500 text-sm mt-0.5">Explora por tipo de producto</p>
            </div>
            <Link
              to="/catalogo"
              className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
            >
              Ver todo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {categories.slice(0, 10).map((cat) => (
              <Link
                key={cat.id}
                to={`/catalogo?category=${cat.id}`}
                id={`category-card-${cat.id}`}
                className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 p-6 text-center border border-gray-100 hover:border-blue-200"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${primaryColor}22` }}
                >
                  <Tag className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <p className="font-semibold text-gray-800 text-sm leading-tight">{cat.name}</p>
                {cat.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">{cat.description}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Productos Destacados ──────────────────────────────────────────── */}
      {!loading && (
        <section className="max-w-7xl mx-auto px-4 pb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-400" />
                Productos Destacados
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">Los favoritos de nuestra tienda</p>
            </div>
            <Link
              to="/catalogo"
              className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>No hay productos destacados por el momento.</p>
              <Link
                to="/catalogo"
                className="mt-4 inline-block text-blue-600 font-medium hover:underline"
              >
                Ver todo el catálogo →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── CTA Final ────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            ¿Tienes alguna pregunta?
          </h2>
          <p className="text-gray-600 mb-6">
            Escríbenos por WhatsApp. Con gusto te atendemos.
          </p>
          {config.whatsapp && (
            <a
              href={`https://wa.me/${config.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-3.5 rounded-full transition shadow-lg shadow-green-200"
              id="contact-whatsapp-btn"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Contáctanos
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
