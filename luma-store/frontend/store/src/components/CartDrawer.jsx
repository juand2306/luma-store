import { useState } from "react";
import { X, ShoppingBag, Trash2, Plus, Minus, MessageCircle, Loader2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import storeClient from "../api/storeClient";
import { buildWhatsAppUrl, buildOrderMessage } from "../utils/whatsapp";
import { useNavigate } from "react-router-dom";

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, clearCart, subtotal, itemCount } = useCart();
  const navigate = useNavigate();

  const [step, setStep] = useState("cart"); // "cart" | "form"
  const [form, setForm] = useState({ name: "", phone: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFormChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Crear el pedido en la BD
      const payload = {
        items: items.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
        })),
        customer_name: form.name || "",
        customer_phone: form.phone || "",
        note: form.note || "",
      };

      const res = await storeClient.post("/store/orders/", payload);
      const order = res.data;

      // 2. Obtener la config de la tienda para el número de WhatsApp
      const configRes = await storeClient.get("/store/config/");
      const waNumber = configRes.data.whatsapp || "";

      // 3. Construir el mensaje y la URL de WhatsApp
      const message = buildOrderMessage({
        ...order,
        note: form.note,
      });
      const waUrl = buildWhatsAppUrl(waNumber, message);

      // 4. Abrir WhatsApp
      window.open(waUrl, "_blank");

      // 5. Limpiar carrito y redirigir a confirmación
      clearCart();
      closeCart();
      navigate("/confirmacion", { state: { order } });
    } catch (err) {
      const respData = err.response?.data;
      if (typeof respData === "string") {
        setError(respData);
      } else if (respData?.items) {
        setError(Array.isArray(respData.items) ? respData.items.join(" ") : respData.items);
      } else if (respData?.detail) {
        setError(respData.detail);
      } else {
        setError("Ocurrió un error al procesar tu pedido. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeCart}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        id="cart-drawer"
      >
        {/* Header del carrito */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900 text-lg">Mi Carrito</h2>
            {itemCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {itemCount}
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="p-2 hover:bg-gray-100 rounded-full transition"
            aria-label="Cerrar carrito"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Contenido */}
        {step === "cart" ? (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
                  <ShoppingBag className="w-16 h-16 mb-4 opacity-30" />
                  <p className="font-medium text-gray-500">Tu carrito está vacío</p>
                  <p className="text-sm mt-1">Agrega productos para continuar</p>
                  <button
                    onClick={closeCart}
                    className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Ver catálogo
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.variant_id}
                    className="flex gap-3 bg-gray-50 rounded-xl p-3"
                    id={`cart-item-${item.variant_id}`}
                  >
                    {/* Imagen */}
                    <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
                      {item.image ? (
                        <img src={item.image} alt={item.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                          Sin imagen
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-1">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[item.size && `Talla: ${item.size}`, item.color && `Color: ${item.color}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="text-blue-600 font-bold text-sm mt-1">
                        ${(item.unit_price * item.quantity).toLocaleString("es-CO")}
                      </p>

                      {/* Controles cantidad */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                          disabled={item.quantity >= item.max_stock}
                          className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Eliminar */}
                    <button
                      onClick={() => removeItem(item.variant_id)}
                      className="text-red-400 hover:text-red-600 transition p-1 self-start"
                      aria-label="Eliminar ítem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer — Total y Acción */}
            {items.length > 0 && (
              <div className="px-5 py-5 border-t border-gray-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Subtotal</span>
                  <span className="text-gray-900 font-bold text-lg">
                    ${subtotal.toLocaleString("es-CO")}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  * El precio final incluye descuentos y costos de envío acordados con la tienda.
                </p>
                <button
                  onClick={() => { setStep("form"); setError(""); }}
                  className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-green-200"
                  id="checkout-btn"
                >
                  <MessageCircle className="w-5 h-5" />
                  Finalizar pedido por WhatsApp
                </button>
                <button
                  onClick={clearCart}
                  className="w-full py-2 text-sm text-gray-400 hover:text-red-500 transition"
                  id="clear-cart-btn"
                >
                  Vaciar carrito
                </button>
              </div>
            )}
          </>
        ) : (
          /* Formulario de datos */
          <form onSubmit={handleCheckout} className="flex flex-col h-full min-h-0">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0">
              <div>
                <button
                  type="button"
                  onClick={() => setStep("cart")}
                  className="text-sm text-blue-600 hover:underline mb-3 flex items-center gap-1"
                >
                  ← Volver al carrito
                </button>
                <h3 className="font-bold text-gray-900 text-lg mb-1">Datos de contacto</h3>
                <p className="text-sm text-gray-500">
                  Completa tus datos para coordinar tu pedido por WhatsApp.
                </p>
              </div>

              {/* Resumen compacto */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                {items.map((item) => (
                  <div key={item.variant_id} className="flex justify-between text-sm">
                    <span className="text-gray-700 truncate max-w-[200px]">
                      {item.product_name}
                      {item.size ? ` (${item.size}` : ""}
                      {item.color ? ` ${item.color})` : item.size ? ")" : ""}
                      {" "}x{item.quantity}
                    </span>
                    <span className="font-medium ml-2 flex-shrink-0">
                      ${(item.unit_price * item.quantity).toLocaleString("es-CO")}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-sm">
                  <span>Total</span>
                  <span className="text-blue-600">${subtotal.toLocaleString("es-CO")}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-gray-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    placeholder="Tu nombre completo"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    id="checkout-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WhatsApp <span className="text-gray-400">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleFormChange}
                    placeholder="Ej: 3001234567"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    id="checkout-phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nota del pedido <span className="text-gray-400">(opcional)</span>
                  </label>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={handleFormChange}
                    rows={2}
                    placeholder="Ej: Por favor enviar a domicilio..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    id="checkout-note"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex gap-2">
                  <span className="flex-shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Botón siempre visible — fuera del scroll */}
            <div className="px-5 py-4 border-t border-gray-100 bg-white flex-shrink-0">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-green-200"
                id="submit-order-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <MessageCircle className="w-5 h-5" />
                )}
                {loading ? "Procesando..." : "Enviar pedido por WhatsApp"}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Se abrirá WhatsApp para confirmar tu pedido
              </p>
            </div>
          </form>

        )}
      </div>
    </>
  );
}
