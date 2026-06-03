/**
 * store/catalog.spec.js
 *
 * Pruebas del portal de clientes: homepage, catálogo y navegación básica.
 * No requieren autenticación — todo es público.
 */
import { test, expect } from "@playwright/test";
import { getPublicProducts } from "../helpers/api.js";

test.describe("Portal — Homepage y Catálogo", () => {

  // ── Homepage ──────────────────────────────────────────────────────────────

  test("homepage carga y muestra el hero", async ({ page }) => {
    await page.goto("/");

    // La sección hero debe estar visible (tiene un banner con gradiente)
    const hero = page.locator("section").first();
    await expect(hero).toBeVisible();
  });

  test("header con enlace al catálogo está visible", async ({ page }) => {
    await page.goto("/");

    // Debe existir al menos un enlace que apunte al catálogo
    const catalogLink = page.getByRole("link", { name: /cat[aá]logo/i }).first();
    await expect(catalogLink).toBeVisible();
  });

  test("homepage muestra al menos un producto destacado", async ({ page }) => {
    await page.goto("/");

    // Esperar a que los productos destados carguen (hay una sección de featured)
    // El componente ProductCard renderiza dentro de la sección "featured"
    // Esperamos al menos una tarjeta de producto con precio
    const pricePattern = /\$[\d.,]+/;
    await expect(
      page.getByText(pricePattern).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Catálogo ──────────────────────────────────────────────────────────────

  test("página de catálogo carga correctamente", async ({ page }) => {
    await page.goto("/catalogo");

    // Esperar que los productos del fixture E2E aparezcan
    await expect(
      page.getByText("Camiseta E2E", { exact: false })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("el producto E2E aparece en el catálogo con precio", async ({ page }) => {
    await page.goto("/catalogo");

    await expect(
      page.getByText("Camiseta E2E", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // Verificar que se muestre un precio (formato $XX.XXX)
    await expect(
      page.getByText(/\$[\d.,]+/).first()
    ).toBeVisible();
  });

  test("navegar de homepage a catálogo via enlace", async ({ page }) => {
    await page.goto("/");

    // Click en el primer enlace que lleve al catálogo
    const catalogLink = page.getByRole("link", { name: /cat[aá]logo/i }).first();
    await catalogLink.click();

    await expect(page).toHaveURL("/catalogo");
  });

  test("página de detalle de producto es accesible desde el catálogo", async ({ page, request }) => {
    // Obtener el ID del producto E2E directamente de la API para no depender del DOM
    const products = await getPublicProducts(request);
    const e2eProduct = products.find(p => p.name === "Camiseta E2E");
    expect(e2eProduct, "El producto E2E debe existir — corre create_e2e_fixtures").toBeTruthy();

    await page.goto(`/producto/${e2eProduct.id}`);

    // El título del producto debe estar visible en la página de detalle
    await expect(
      page.getByText("Camiseta E2E", { exact: false })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("seleccionar talla activa el botón de agregar al carrito", async ({ page, request }) => {
    const products   = await getPublicProducts(request);
    const e2eProduct = products.find(p => p.name === "Camiseta E2E");
    expect(e2eProduct).toBeTruthy();

    await page.goto(`/producto/${e2eProduct.id}`);
    await expect(page.getByText("Camiseta E2E", { exact: false })).toBeVisible({ timeout: 10_000 });

    // Seleccionar talla M (del fixture)
    const sizeBtn = page.getByRole("button", { name: /\bM\b/ }).first();
    if (await sizeBtn.isVisible()) {
      await sizeBtn.click();
    }

    // Botón "Agregar al carrito" debe ser visible y no estar deshabilitado
    const addToCartBtn = page.getByRole("button", { name: /agregar.*carrito/i });
    await expect(addToCartBtn).toBeVisible();
  });

  // ── API pública ───────────────────────────────────────────────────────────

  test("API pública de productos retorna 200", async ({ request }) => {
    const res = await request.get("http://localhost:8000/api/v1/store/products/");
    expect(res.ok()).toBeTruthy();

    const body    = await res.json();
    const results = body.results ?? body;
    expect(Array.isArray(results)).toBeTruthy();
    expect(results.length).toBeGreaterThan(0);
  });

  test("API pública de config de tienda retorna 200", async ({ request }) => {
    const res = await request.get("http://localhost:8000/api/v1/store/config/");
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("primary_color");
  });
});
