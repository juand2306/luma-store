import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Search, Menu, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useState, useEffect } from "react";

export default function Header({ config: configProp }) {
  const { itemCount, toggleCart } = useCart();
  const config = configProp || { name: "LUMA", primary_color: "#0D8585" };
  const [search, setSearch]           = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled]       = useState(false);
  const navigate = useNavigate();

  // Transparent at top → white with border once scrolled 60px
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/catalogo?search=${encodeURIComponent(search.trim())}`);
      setSearch("");
      setMobileMenuOpen(false);
    }
  };

  const isOpaque = scrolled || mobileMenuOpen;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        isOpaque
          ? "bg-white border-b border-gray-100 shadow-[0_1px_0_rgba(0,0,0,0.05)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo / Nombre */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          {config.logo ? (
            <img
              src={config.logo}
              alt={config.name}
              className="h-8 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <span
              className="text-gray-900 text-lg tracking-[0.1em] uppercase"
              style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
            >
              {config.name || "LUMA"}
            </span>
          )}
        </Link>

        {/* Barra de búsqueda — solo escritorio */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xs mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-9 pr-4 py-2 rounded-full text-sm bg-white border border-gray-200
                         text-gray-800 placeholder-gray-400 focus:outline-none
                         focus:border-gray-400 transition-colors"
            />
          </div>
        </form>

        {/* Nav escritorio */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/catalogo"
            className="text-gray-700 text-[13px] font-light tracking-[0.04em]
                       hover:text-gray-900 transition-colors duration-200"
          >
            Colección
          </Link>
        </nav>

        {/* Carrito + Hamburger */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleCart}
            className="relative p-1.5 text-gray-800 hover:text-gray-500 transition-colors"
            aria-label="Abrir carrito"
            id="cart-toggle-btn"
          >
            <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            {itemCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full
                           text-white text-[9px] flex items-center justify-center font-semibold"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </button>

          {/* Hamburger — solo móvil */}
          <button
            className="md:hidden p-1.5 text-gray-800 hover:text-gray-500 transition-colors"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menú"
          >
            {mobileMenuOpen
              ? <X className="w-5 h-5" strokeWidth={1.5} />
              : <Menu className="w-5 h-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Menú móvil */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-5 space-y-4">
          <form onSubmit={handleSearch}>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-9 pr-4 py-2.5 rounded-full text-sm bg-gray-50
                           border border-gray-200 text-gray-800 placeholder-gray-400
                           focus:outline-none focus:border-gray-400 transition-colors"
              />
            </div>
          </form>
          <Link
            to="/catalogo"
            className="block text-gray-700 font-light text-sm tracking-wide py-1
                       hover:text-gray-900 transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Colección
          </Link>
        </div>
      )}
    </header>
  );
}
