import axios from "axios";

// Cliente Axios para el portal de clientes — todo es público, sin autenticación.
//
// VITE_API_URL debe apuntar a la raíz del backend (ej: http://localhost:8000
// o https://mi-backend.railway.app). El prefijo /api/v1 se añade aquí
// automáticamente.
//
// Si VITE_API_URL no está definido, se usa el proxy de Vite (/api → :8000).
const _base = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api/v1`
  : "/api/v1";

const storeClient = axios.create({
  baseURL: _base,
});

export default storeClient;

