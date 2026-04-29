import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Search, Store, Menu, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useState, useEffect } from "react";
import storeClient from "../api/storeClient";

export default function Header() {
  const { itemCount, toggleCart } = useCart();
  const [config, setConfig] = useState({ name: "LUMA Store", primary_color: "#2E86C1" });
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    storeClient
      .get("/store/config/")
      .then((r) => setConfig(r.data))
      .catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/catalogo?search=${encodeURIComponent(search.trim())}`);
      setSearch("");
      setMobileMenuOpen(false);
    }
  };

  return (
    <header
      className="sticky top-0 z-50 shadow-lg"
      style={{ backgroundColor: config.primary_color || "#2E86C1" }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo / Nombre */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <Store className="w-6 h-6 text-white" />
          <span className="text-white font-bold text-lg leading-tight hidden sm:block">
            {config.name}
          </span>
        </Link>

        {/* Barra de búsqueda — escritorio */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex flex-1 max-w-md mx-4"
        >
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full pl-10 pr-4 py-2 rounded-full text-sm bg-white/95 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </form>

        {/* Nav escritorio */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/catalogo" className="text-white/90 hover:text-white text-sm font-medium transition">
            Catálogo
          </Link>
        </nav>

        {/* Carrito + Menú móvil */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCart}
            className="relative p-2 text-white hover:bg-white/20 rounded-full transition"
            aria-label="Abrir carrito"
            id="cart-toggle-btn"
          >
            <ShoppingCart className="w-6 h-6" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-bounce">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </button>

          {/* Botón hamburguesa móvil */}
          <button
            className="md:hidden p-2 text-white hover:bg-white/20 rounded-full transition"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menú"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Menú móvil desplegable */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-black/20 backdrop-blur-sm px-4 py-4 space-y-3 border-t border-white/10">
          <form onSubmit={handleSearch} className="flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-10 pr-4 py-2 rounded-full text-sm bg-white/95 text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>
          </form>
          <Link
            to="/catalogo"
            className="block text-white font-medium py-1"
            onClick={() => setMobileMenuOpen(false)}
          >
            Catálogo
          </Link>
        </div>
      )}
    </header>
  );
}
