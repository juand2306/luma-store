import { MessageCircle, MapPin, Clock } from "lucide-react";

export default function Footer({ config: configProp }) {
  const config = configProp || {
    name: "LUMA Store",
    whatsapp: "",
    address: "",
    schedule: "",
    return_policy: "",
  };

  const waLink = config.whatsapp
    ? `https://wa.me/${config.whatsapp.replace(/\D/g, "")}`
    : "#";

  return (
    <footer className="bg-[#0A0A0A] text-gray-500">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-10">

        {/* Marca */}
        <div>
          {config.logo ? (
            <img
              src={config.logo}
              alt={config.name}
              className="h-8 w-auto max-w-[120px] object-contain brightness-0 invert mb-5 opacity-80"
            />
          ) : (
            <p
              className="text-white text-xl mb-5 tracking-[0.08em] uppercase"
              style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}
            >
              {config.name}
            </p>
          )}
          <p className="text-sm font-light leading-relaxed text-gray-500">
            Tu tienda de ropa y accesorios.<br />Calidad y estilo para cada ocasión.
          </p>
        </div>

        {/* Contacto */}
        <div>
          <p className="eyebrow text-gray-600 mb-5">Contacto</p>
          <ul className="space-y-3 text-sm font-light">
            {config.whatsapp && (
              <li>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-gray-400 hover:text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                  {config.whatsapp}
                </a>
              </li>
            )}
            {config.address && (
              <li className="flex items-start gap-2.5 text-gray-400">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>{config.address}</span>
              </li>
            )}
            {config.schedule && (
              <li className="flex items-center gap-2.5 text-gray-400">
                <Clock className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                {config.schedule}
              </li>
            )}
          </ul>
        </div>

        {/* Política */}
        <div>
          <p className="eyebrow text-gray-600 mb-5">Envíos y Devoluciones</p>
          <p className="text-sm font-light leading-relaxed text-gray-400 whitespace-pre-line">
            {config.return_policy || "Consulta nuestra política de envíos y devoluciones por WhatsApp."}
          </p>
        </div>
      </div>

      <div className="border-t border-white/5 py-5 text-center">
        <p className="text-[11px] text-gray-700 tracking-[0.08em]">
          © {new Date().getFullYear()} {config.name}
        </p>
      </div>
    </footer>
  );
}
