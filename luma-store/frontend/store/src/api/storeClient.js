import axios from "axios";

// Cliente Axios para el portal de clientes — todo es público, sin autenticación
// En desarrollo, Vite proxy redirige /api → localhost:8000
const storeClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
});

export default storeClient;

