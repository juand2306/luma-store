/**
 * global.setup.js
 *
 * Se ejecuta UNA VEZ antes de todos los tests del proyecto "admin".
 * Hace login en el panel de administración y guarda el estado de
 * autenticación (localStorage con luma_access/luma_refresh) en
 * fixtures/admin-auth.json para que todos los tests admin lo reutilicen
 * sin tener que hacer login individualmente.
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE  = path.join(__dirname, "fixtures", "admin-auth.json");

setup("autenticar usuario admin", async ({ page }) => {
  await page.goto("/login");

  // Esperar que el formulario esté listo
  await expect(page.getByPlaceholder("tu.usuario")).toBeVisible();

  // Ingresar credenciales (creadas por create_e2e_fixtures)
  await page.getByPlaceholder("tu.usuario").fill("e2e_admin");
  await page.getByPlaceholder("••••••••").fill("e2e_luma_2024");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  // Esperar redirección al dashboard
  await expect(page).toHaveURL("/", { timeout: 10_000 });

  // Guardar el estado completo (localStorage incluido)
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`  ✓ Auth guardado en ${AUTH_FILE}`);
});
