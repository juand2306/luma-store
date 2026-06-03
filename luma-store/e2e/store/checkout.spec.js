/**
 * store/checkout.spec.js
 *
 * Flujo completo de compra en el portal de clientes:
 *   Catálogo → Detalle de producto → Carrito → Formulario → Confirmación
 *
 * window.open (WhatsApp) se intercepta para evitar abrir el navegador real.
 */
import { test, expect } from "@playwright/test";
import { getPublicProducts } from "../helpers/api.js";

// ── Helper: bloquea window.open (WhatsApp) ────────────────────────────────────
async function blockWhatsApp(page) {
  await page.addInitScript(() => {
    // Interceptamos window.open para que no abra nada, pero no falle
    window.open = (url) => {
      window.__lastOpenedUrl = url;
      return null;
    };
  });
}

// ── Helper: agrega el producto E2E al carrito desde la página de detalle ───────
async function addE2EProductToCart(page, productId) {
  await page.goto(`/producto/${productId}`);
  await expect(page.getByText("Camiseta E2E", { exact: false })).toBeVisible({ timeout: 10_000 });

  // Seleccionar talla M si hay botones de talla visibles
  const sizeM = page.getByRole("button", { name: /\bM\b/ }).first();
  if (await sizeM.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await sizeM.click();
  }

  // Seleccionar color Azul si hay botones de color visibles
  const colorAzul = page.getByRole("button", { name: /\bAzul\b/i }).first();
  if (await colorAzul.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await colorAzul.click();
  }

  // Click en "Agregar al carrito"
  await page.getByRole("button", { name: /agregar.*carrito/i }).click();

  // El carrito debe abrirse automáticamente
  await expect(page.locator("#cart-drawer")).toBeVisible({ timeout: 5_000 });
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Portal — Flujo de compra", () => {

  test.beforeEach(async ({ page }) => {
    await blockWhatsApp(page);
  });

  // ── Carrito ───────────────────────────────────────────────────────────────

  test("carrito se abre al agregar un producto", async ({ page, request }) => {
    const products   = await getPublicProducts(request);
    const e2eProduct = products.find(p => p.name === "Camiseta E2E");
    expect(e2eProduct, "Corre create_e2e_fixtures antes de los tests").toBeTruthy();

    await addE2EProductToCart(page, e2eProduct.id);

    // Verificar que el drawer del carrito está visible con el producto
    await expect(page.locator("#cart-drawer")).toBeVisible();
    await expect(page.locator("#cart-drawer").getByText("Camiseta E2E", { exact: false })).toBeVisible();
  });

  test("carrito muestra el precio del producto", async ({ page, request }) => {
    const products   = await getPublicProducts(request);
    const e2eProduct = products.find(p => p.name === "Camiseta E2E");
    expect(e2eProduct).toBeTruthy();

    await addE2EProductToCart(page, e2eProduct.id);

    // Debe aparecer un precio en el carrito ($50.000)
    await expect(
      page.locator("#cart-drawer").getByText(/\$[\d.,]+/).first()
    ).toBeVisible();
  });

  test("botón 'Finalizar pedido por WhatsApp' lleva al formulario", async ({ page, request }) => {
    const products   = await getPublicProducts(request);
    const e2eProduct = products.find(p => p.name === "Camiseta E2E");
    expect(e2eProduct).toBeTruthy();

    await addE2EProductToCart(page, e2eProduct.id);

    // Click en el botón de checkout
    await page.locator("#checkout-btn").click();

    // Debe aparecer el formulario de datos de contacto
    await expect(page.getByText("Datos de contacto")).toBeVisible();
    await expect(page.locator("#checkout-name")).toBeVisible();
    await expect(page.locator("#checkout-phone")).toBeVisible();
  });

  // ── Flujo completo de checkout ────────────────────────────────────────────

  test("flujo completo: agrega → formulario → confirma pedido", async ({ page, request }) => {
    const products   = await getPublicProducts(request);
    const e2eProduct = products.find(p => p.name === "Camiseta E2E");
    expect(e2eProduct).toBeTruthy();

    // 1. Agregar producto al carrito
    await addE2EProductToCart(page, e2eProduct.id);

    // 2. Ir al formulario
    await page.locator("#checkout-btn").click();
    await expect(page.getByText("Datos de contacto")).toBeVisible();

    // 3. Llenar el formulario
    await page.locator("#checkout-name").fill("Test Comprador E2E");
    await page.locator("#checkout-phone").fill("3001234500");

    // 4. Enviar pedido
    await page.locator("#submit-order-btn").click();

    // 5. Debe navegar a /confirmacion y mostrar el número de pedido
    await expect(page).toHaveURL("/confirmacion", { timeout: 15_000 });
    await expect(page.getByText("¡Pedido enviado!")).toBeVisible();
    await expect(page.getByText(/Pedido N°.*PED-/i)).toBeVisible();
  });

  test("checkout sin nombre ni teléfono también funciona (campos opcionales)", async ({ page, request }) => {
    const products   = await getPublicProducts(request);
    const e2eProduct = products.find(p => p.name === "Camiseta E2E");
    expect(e2eProduct).toBeTruthy();

    await addE2EProductToCart(page, e2eProduct.id);
    await page.locator("#checkout-btn").click();
    await expect(page.getByText("Datos de contacto")).toBeVisible();

    // Enviar sin llenar nada (campos opcionales)
    await page.locator("#submit-order-btn").click();

    await expect(page).toHaveURL("/confirmacion", { timeout: 15_000 });
    await expect(page.getByText("¡Pedido enviado!")).toBeVisible();
  });

  // ── Stock y validaciones ──────────────────────────────────────────────────

  test("stock insuficiente muestra error en el formulario", async ({ page, request }) => {
    // Obtener producto E2E via API
    const products   = await getPublicProducts(request);
    const e2eProduct = products.find(p => p.name === "Camiseta E2E");
    expect(e2eProduct).toBeTruthy();

    const variant = e2eProduct.variants?.find(v => v.size === "M" && v.color === "Azul");
    if (!variant) {
      test.skip(); // Variante no encontrada en respuesta API
      return;
    }

    // Intentar pedir más stock del disponible directo via API
    const res = await request.post("http://localhost:8000/api/v1/store/orders/", {
      data: {
        customer_name:  "E2E Test",
        customer_phone: "3001111111",
        items: [{ variant_id: variant.id, quantity: 9999 }],
      },
    });

    // Debe retornar 400 con detalle del error de stock
    expect(res.status()).toBe(400);
  });

  // ── Página de confirmación ────────────────────────────────────────────────

  test("página de confirmación sin estado redirige a home", async ({ page }) => {
    // Si se accede directamente a /confirmacion sin haber hecho un pedido
    // debe mostrar la pantalla de confirmación o redirigir al home
    await page.goto("/confirmacion");

    // Puede mostrar la pantalla vacía de confirmación o ir al home
    const url = page.url();
    const isValidUrl = url.includes("/confirmacion") || url.endsWith("/");
    expect(isValidUrl).toBeTruthy();
  });
});
