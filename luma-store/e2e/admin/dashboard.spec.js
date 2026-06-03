/**
 * admin/dashboard.spec.js
 *
 * Pruebas del dashboard del panel de administración.
 * Usa el storageState guardado por global.setup.js (no hace login manual).
 */
import { test, expect } from "@playwright/test";
import { authHeaders } from "../helpers/api.js";

test.describe("Admin — Dashboard", () => {

  test("dashboard carga sin redirigir a login", async ({ page }) => {
    await page.goto("/");

    // No debe estar en la página de login
    await expect(page).not.toHaveURL("/login");
    await expect(page.getByPlaceholder("tu.usuario")).not.toBeVisible();
  });

  test("dashboard muestra estadísticas de ventas", async ({ page }) => {
    await page.goto("/");

    // El dashboard tiene secciones/tarjetas de estadísticas
    // (ventas, pedidos, clientes, caja)
    // Buscamos cualquier cifra estadística o heading de sección
    await expect(
      page.getByText(/ventas|pedidos|clientes|inventario/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("sidebar de navegación está visible", async ({ page }) => {
    await page.goto("/");

    // El sidebar contiene los items principales de navegación
    await expect(
      page.getByRole("link", { name: /inventario/i })
    ).toBeVisible({ timeout: 8_000 });
  });

  test("navegar a página de pedidos funciona", async ({ page }) => {
    await page.goto("/");

    // Click en el enlace de pedidos del sidebar
    await page.getByRole("link", { name: /pedidos/i }).click();
    await expect(page).toHaveURL("/pedidos");

    // La página de pedidos debe tener un heading
    await expect(
      page.getByRole("heading", { name: /pedidos/i })
    ).toBeVisible({ timeout: 8_000 });
  });

  test("navegar a inventario funciona", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /inventario/i }).click();
    await expect(page).toHaveURL("/inventario");
  });

  test("navegar a clientes funciona", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /clientes/i }).click();
    await expect(page).toHaveURL("/clientes");
  });

  test("rutas protegidas requieren autenticación (API)", async ({ request }) => {
    // Sin token → 401
    const res = await request.get("http://localhost:8000/api/v1/orders/");
    expect([401, 403]).toContain(res.status());
  });

  test("API de dashboard accesible con token válido", async ({ request }) => {
    const headers = await authHeaders(request);

    // El endpoint de pedidos debe responder 200 con token
    const res = await request.get("http://localhost:8000/api/v1/orders/", { headers });
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty("results");
  });
});
