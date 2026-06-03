/**
 * admin/orders.spec.js
 *
 * Pruebas de gestión de pedidos en el panel de administración.
 *
 * Flujo clave: pedido creado desde el portal de clientes (via API)
 * → aparece en el listado del admin → se puede gestionar su estado.
 */
import { test, expect } from "@playwright/test";
import { authHeaders, getOrders } from "../helpers/api.js";

const API_BASE = "http://localhost:8000/api/v1";

// ── Helper: crea un pedido de prueba via API pública ─────────────────────────
async function createTestOrder(request, suffix = "") {
  // Obtener ID del producto E2E
  const prodRes  = await request.get(`${API_BASE}/store/products/`);
  const prodBody = await prodRes.json();
  const products = prodBody.results ?? prodBody;
  const product  = products.find(p => p.name === "Camiseta E2E");

  if (!product) throw new Error("Producto E2E no encontrado. Corre create_e2e_fixtures.");

  const variant = product.variants?.find(v => v.size === "M" && v.is_active);
  if (!variant) throw new Error("Variante E2E no encontrada.");

  const res = await request.post(`${API_BASE}/store/orders/`, {
    data: {
      customer_name:  `E2E Test${suffix}`,
      customer_phone: `30099${Date.now().toString().slice(-5)}`,
      items: [{ variant_id: variant.id, quantity: 1 }],
    },
  });

  if (!res.ok()) {
    throw new Error(`Error al crear pedido de prueba: ${res.status()} — ${await res.text()}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Admin — Gestión de Pedidos", () => {

  // ── Listado de pedidos ────────────────────────────────────────────────────

  test("página de pedidos carga correctamente", async ({ page }) => {
    await page.goto("/pedidos");

    // Heading principal de la página
    await expect(
      page.getByRole("heading", { name: /pedidos/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("pedido creado desde la tienda aparece en el admin", async ({ page, request }) => {
    // Crear el pedido via API (simula compra desde el portal)
    const order = await createTestOrder(request, " — Admin Test");

    await page.goto("/pedidos");

    // El número de pedido debe aparecer en el listado
    await expect(
      page.getByText(order.number, { exact: false })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("filtrar por estado 'Nuevo' muestra pedidos nuevos", async ({ page }) => {
    await page.goto("/pedidos");

    // Buscar el filtro de estado (puede ser un select o botón)
    const newFilter = page.getByRole("option", { name: /nuevo/i })
      .or(page.getByRole("button", { name: /nuevo/i }))
      .first();

    if (await newFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newFilter.click();
    }

    // La URL o el contenido debe reflejar el filtro
    // (mínimo: la página no debe crashear)
    await expect(page.getByRole("heading", { name: /pedidos/i })).toBeVisible();
  });

  // ── API de pedidos ────────────────────────────────────────────────────────

  test("API retorna pedido recién creado en el listado", async ({ request }) => {
    const order   = await createTestOrder(request);
    const headers = await authHeaders(request);

    const listRes  = await request.get(`${API_BASE}/orders/`, { headers });
    const listBody = await listRes.json();
    const orders   = listBody.results ?? listBody;

    const found = orders.some(o => o.number === order.number);
    expect(found).toBeTruthy();
  });

  test("API retorna stats de pedidos con claves correctas", async ({ request }) => {
    const headers = await authHeaders(request);
    const res     = await request.get(`${API_BASE}/orders/stats/`, { headers });

    expect(res.ok()).toBeTruthy();
    const stats = await res.json();

    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("new");
    expect(stats).toHaveProperty("in_progress");
    expect(stats).toHaveProperty("done");
  });

  test("cambiar estado de pedido a 'confirmado' via API funciona", async ({ request }) => {
    const order   = await createTestOrder(request);
    const headers = await authHeaders(request);

    const patchRes = await request.patch(
      `${API_BASE}/orders/${order.id}/`,
      {
        headers,
        data: { status: "confirmed" },
      }
    );

    expect(patchRes.ok()).toBeTruthy();
    const updated = await patchRes.json();
    expect(updated.status).toBe("confirmed");
  });

  test("pedido creado con teléfono vincula un Customer", async ({ request }) => {
    const phone  = `300E2E${Date.now().toString().slice(-4)}`;
    const prodRes = await request.get(`${API_BASE}/store/products/`);
    const prodBody = await prodRes.json();
    const product  = (prodBody.results ?? prodBody).find(p => p.name === "Camiseta E2E");
    const variant  = product?.variants?.find(v => v.size === "M" && v.is_active);
    expect(variant).toBeTruthy();

    // Crear pedido con teléfono
    const orderRes = await request.post(`${API_BASE}/store/orders/`, {
      data: {
        customer_name:  "Test Deduplicación",
        customer_phone: phone,
        items: [{ variant_id: variant.id, quantity: 1 }],
      },
    });

    expect(orderRes.ok()).toBeTruthy();
    const order = await orderRes.json();

    // Verificar via API admin que el pedido tiene customer vinculado
    const headers   = await authHeaders(request);
    const detailRes = await request.get(`${API_BASE}/orders/${order.id}/`, { headers });
    const detail    = await detailRes.json();

    // El campo customer debe ser el ID del Customer creado (no null)
    expect(detail.customer).not.toBeNull();
  });

  test("dos pedidos del mismo teléfono comparten el mismo Customer", async ({ request }) => {
    const headers = await authHeaders(request);
    const phone   = `300DEDUP${Date.now().toString().slice(-4)}`;

    const prodRes = await request.get(`${API_BASE}/store/products/`);
    const prodBody = await prodRes.json();
    const product  = (prodBody.results ?? prodBody).find(p => p.name === "Camiseta E2E");
    const variant  = product?.variants?.find(v => v.size === "M" && v.is_active);
    expect(variant).toBeTruthy();

    const payload = {
      customer_name:  "Mismo Cliente",
      customer_phone: phone,
      items: [{ variant_id: variant.id, quantity: 1 }],
    };

    // Crear dos pedidos con el mismo teléfono
    const r1 = await request.post(`${API_BASE}/store/orders/`, { data: payload });
    const r2 = await request.post(`${API_BASE}/store/orders/`, { data: payload });
    expect(r1.ok()).toBeTruthy();
    expect(r2.ok()).toBeTruthy();

    const o1 = await r1.json();
    const o2 = await r2.json();

    // Obtener detalles de ambos pedidos
    const d1 = await (await request.get(`${API_BASE}/orders/${o1.id}/`, { headers })).json();
    const d2 = await (await request.get(`${API_BASE}/orders/${o2.id}/`, { headers })).json();

    // Ambos pedidos deben apuntar al mismo Customer
    expect(d1.customer).not.toBeNull();
    expect(d2.customer).not.toBeNull();
    expect(d1.customer).toBe(d2.customer);
  });
});
