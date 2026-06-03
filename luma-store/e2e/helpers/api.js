/**
 * helpers/api.js
 *
 * Utilidades para interactuar directamente con el backend Django en los tests E2E.
 * Útil para:
 *   - Verificar estado de la BD sin ir por la UI
 *   - Limpiar datos creados por los tests
 *   - Obtener IDs de recursos creados
 */

const API_BASE     = "http://localhost:8000/api/v1";
const E2E_USERNAME = "e2e_admin";
const E2E_PASSWORD = "e2e_luma_2024";

let _cachedToken = null;

/** Obtiene (y cachea) el token JWT del usuario de prueba. */
export async function getAuthToken(request) {
  if (_cachedToken) return _cachedToken;

  const res = await request.post(`${API_BASE}/auth/login/`, {
    data: { username: E2E_USERNAME, password: E2E_PASSWORD },
  });

  if (!res.ok()) {
    throw new Error(
      `Login E2E fallido (${res.status()}). ¿Corriste create_e2e_fixtures?`
    );
  }

  const body    = await res.json();
  _cachedToken  = body.access;
  return _cachedToken;
}

/** Limpia el token cacheado (útil entre suites si el token expiró). */
export function clearTokenCache() {
  _cachedToken = null;
}

/** Retorna headers de autorización listos para usar en request de Playwright. */
export async function authHeaders(request) {
  const token = await getAuthToken(request);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Obtiene el listado de pedidos del admin.
 * @returns {Promise<Array>} Lista de pedidos
 */
export async function getOrders(request) {
  const headers = await authHeaders(request);
  const res     = await request.get(`${API_BASE}/orders/`, { headers });
  const body    = await res.json();
  return body.results ?? body;
}

/**
 * Obtiene la configuración pública de la tienda.
 * @returns {Promise<Object>}
 */
export async function getStoreConfig(request) {
  const res  = await request.get(`${API_BASE}/store/config/`);
  return res.json();
}

/**
 * Obtiene el listado de productos públicos del portal.
 * @returns {Promise<Array>}
 */
export async function getPublicProducts(request) {
  const res  = await request.get(`${API_BASE}/store/products/`);
  const body = await res.json();
  return body.results ?? body;
}
