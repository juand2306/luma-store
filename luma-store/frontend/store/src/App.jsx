import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

// Resetea el scroll al inicio en cada cambio de ruta
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
import { CartProvider } from "./context/CartContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CartDrawer from "./components/CartDrawer";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import ProductDetail from "./pages/ProductDetail";
import OrderConfirmation from "./pages/OrderConfirmation";
import storeClient from "./api/storeClient";

// ── App con color de marca dinámico ──────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    storeClient.get("/store/config/")
      .then(({ data }) => {
        // Aplicar color primario de la tienda como CSS variable
        const color = data.primary_color || "#0D8585"
        document.documentElement.style.setProperty("--color-primary", color)
        document.documentElement.style.setProperty("--color-primary-rgb", hexToRgb(color))
        // Actualizar título de la pestaña
        if (data.name) document.title = `${data.name} — Tienda Online`
        setConfig(data)
      })
      .catch(() => {
        // Fallback: color LUMA teal
        document.documentElement.style.setProperty("--color-primary", "#0D8585")
      })
  }, [])

  return (
    <BrowserRouter>
      <ScrollToTop />
      <CartProvider>
        <div className="min-h-screen flex flex-col bg-store-bg">
          <Header config={config} />
          <CartDrawer config={config} />
          <main className="flex-1">
            <Routes>
              <Route path="/"             element={<Home config={config} />} />
              <Route path="/catalogo"     element={<Catalog />} />
              <Route path="/producto/:id" element={<ProductDetail />} />
              <Route path="/confirmacion" element={<OrderConfirmation />} />
              <Route path="*"             element={<Home config={config} />} />
            </Routes>
          </main>
          <Footer config={config} />
        </div>
      </CartProvider>
    </BrowserRouter>
  )
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return "13, 133, 133"
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}
