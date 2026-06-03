/**
 * admin/auth.spec.js
 *
 * Pruebas de autenticación del panel de administración.
 * Este archivo NO usa el storageState guardado — prueba el flujo de login
 * desde cero para verificar que el sistema de auth funciona correctamente.
 */
import { test, expect } from "@playwright/test";

// Resetear el storageState para este archivo — probamos la UI de login
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Admin — Autenticación", () => {

  test("página de login muestra el formulario correcto", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByPlaceholder("tu.usuario")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("credenciales incorrectas muestran mensaje de error", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("tu.usuario").fill("usuario_que_no_existe");
    await page.getByPlaceholder("••••••••").fill("contraseña_incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // Debe aparecer el mensaje de error (no redirige)
    await expect(
      page.getByText(/credenciales incorrectas/i)
    ).toBeVisible({ timeout: 8_000 });

    // No debe haber navegado fuera del login
    await expect(page).toHaveURL("/login");
  });

  test("credenciales vacías muestran validación", async ({ page }) => {
    await page.goto("/login");

    // Click sin llenar nada
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // Debe mostrar error de validación
    await expect(
      page.getByText(/ingresa.*usuario.*contraseña/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("login exitoso redirige al dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("tu.usuario").fill("e2e_admin");
    await page.getByPlaceholder("••••••••").fill("e2e_luma_2024");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // Esperar redirección al dashboard
    await expect(page).toHaveURL("/", { timeout: 10_000 });

    // El dashboard debe mostrar algún contenido de administración
    // (no estar en la pantalla de login)
    await expect(page.getByPlaceholder("tu.usuario")).not.toBeVisible();
  });

  test("usuario autenticado es redirigido desde /login al dashboard", async ({ page }) => {
    // Primero hacer login
    await page.goto("/login");
    await page.getByPlaceholder("tu.usuario").fill("e2e_admin");
    await page.getByPlaceholder("••••••••").fill("e2e_luma_2024");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL("/", { timeout: 10_000 });

    // Intentar ir a /login nuevamente → debe redirigir al dashboard
    await page.goto("/login");
    await expect(page).toHaveURL("/", { timeout: 5_000 });
  });

  test("API de login retorna tokens JWT", async ({ request }) => {
    const res = await request.post("http://localhost:8000/api/v1/auth/login/", {
      data: { username: "e2e_admin", password: "e2e_luma_2024" },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("access");
    expect(body).toHaveProperty("refresh");
    // El access token es un JWT (3 partes separadas por punto)
    expect(body.access.split(".").length).toBe(3);
  });

  test("API de login falla con credenciales incorrectas (401)", async ({ request }) => {
    const res = await request.post("http://localhost:8000/api/v1/auth/login/", {
      data: { username: "noexiste", password: "wrongpass" },
    });

    expect(res.status()).toBe(401);
  });
});
