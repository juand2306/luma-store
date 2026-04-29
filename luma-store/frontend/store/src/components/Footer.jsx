import { useEffect, useState } from "react";
import { MessageCircle, Store, Clock, MapPin } from "lucide-react";
import storeClient from "../api/storeClient";

export default function Footer() {
  const [config, setConfig] = useState({
    name: "LUMA Store",
    whatsapp: "",
    address: "",
    schedule: "",
    return_policy: "",
    primary_color: "#2E86C1",
  });

  useEffect(() => {
    storeClient
      .get("/store/config/")
      .then((r) => setConfig(r.data))
      .catch(() => {});
  }, []);

  const waLink = config.whatsapp
    ? `https://wa.me/${config.whatsapp.replace(/\D/g, "")}`
    : "#";

  return (
    <footer className="bg-gray-900 text-gray-400 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Marca */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Store className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-lg">{config.name}</span>
          </div>
          <p className="text-sm leading-relaxed">
            Tu tienda de ropa y accesorios. Calidad y estilo para cada ocasión.
          </p>
        </div>

        {/* Contacto */}
        <div>
          <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">
            Contacto
          </h3>
          <ul className="space-y-2 text-sm">
            {config.whatsapp && (
              <li>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-green-400 transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp: {config.whatsapp}
                </a>
              </li>
            )}
            {config.address && (
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {config.address}
              </li>
            )}
            {config.schedule && (
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {config.schedule}
              </li>
            )}
          </ul>
        </div>

        {/* Política */}
        <div>
          <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">
            Envíos y Devoluciones
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-line">
            {config.return_policy || "Consulta nuestra política de envíos y devoluciones por WhatsApp."}
          </p>
        </div>
      </div>

      <div className="border-t border-gray-800 py-4 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} {config.name}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
