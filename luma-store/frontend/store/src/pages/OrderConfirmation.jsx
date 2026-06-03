import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { CheckCircle2, ShoppingBag, MessageCircle } from "lucide-react";

export default function OrderConfirmation() {
  const location = useLocation();
  const order = location.state?.order;

  useEffect(() => {
    document.title = "Pedido enviado — LUMA Store";
    // Scroll al inicio
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center">
        {/* Ícono de éxito */}
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>

        {/* Título */}
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
          ¡Pedido enviado!
        </h1>
        <p className="text-gray-600 text-lg mb-6">
          Tu pedido fue registrado exitosamente. El equipo de la tienda te atenderá en breve por WhatsApp.
        </p>

        {/* Número de pedido */}
        {order?.number && (
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-5 py-3 rounded-full mb-8 font-semibold text-sm">
            🔖 Pedido N°: {order.number}
          </div>
        )}

        {/* Resumen del pedido */}
        {order?.items && order.items.length > 0 && (
          <div className="bg-gray-50 rounded-2xl p-5 mb-8 text-left space-y-3">
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wider mb-3">
              Resumen de tu pedido
            </h2>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <div>
                  <p className="font-medium text-gray-800">{item.product_name}</p>
                  <p className="text-gray-500 text-xs">
                    {[item.size && `Talla ${item.size}`, item.color && `Color ${item.color}`]
                      .filter(Boolean)
                      .join(" · ")}
                    {" "}× {item.quantity}
                  </p>
                </div>
                <span className="font-semibold text-gray-900">
                  ${Number(item.subtotal).toLocaleString("es-CO")}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-base">
              <span>Total estimado</span>
              <span className="text-blue-600">${Number(order.total).toLocaleString("es-CO")}</span>
            </div>
          </div>
        )}

        {/* Siguientes pasos */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 text-left">
          <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            ¿Qué sigue?
          </h3>
          <ol className="text-sm text-amber-700 space-y-2 list-decimal list-inside">
            <li>El equipo revisará tu pedido y te contactará por WhatsApp.</li>
            <li>Coordinarán contigo el método de pago.</li>
            <li>Recibirás confirmación cuando tu pedido esté listo.</li>
          </ol>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200"
            id="confirmation-home-btn"
          >
            Ir al inicio
          </Link>
          <Link
            to="/catalogo"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition"
            id="confirmation-catalog-btn"
          >
            <ShoppingBag className="w-4 h-4" />
            Seguir comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
