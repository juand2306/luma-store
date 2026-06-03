// @ts-check
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E — LUMA Store
 *
 * Requisitos antes de correr:
 *   1. Backend Django corriendo en http://localhost:8000
 *   2. Admin frontend corriendo en  http://localhost:5173  (npm run dev)
 *   3. Store frontend corriendo en  http://localhost:5174  (npm run dev)
 *   4. Fixtures creadas:  python manage.py create_e2e_fixtures
 *
 * Correr:
 *   npm test              → todos los tests (headless)
 *   npm run test:store    → solo store
 *   npm run test:admin    → solo admin
 *   npm run test:headed   → modo visible (útil para debug)
 *   npm run report        → abrir reporte HTML
 */

const ADMIN_URL = "http://localhost:5173";
const STORE_URL = "http://localhost:5174";

export default defineConfig({
  // ── Configuración global ──────────────────────────────────────────────────
  testDir: ".",
  timeout: 30_000,          // 30 s por test
  expect: { timeout: 8_000 },
  fullyParallel: false,     // secuencial → evita race conditions en la BD
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  // ── Artifacts en caso de fallo ────────────────────────────────────────────
  use: {
    trace:      "on-first-retry",
    screenshot: "only-on-failure",
    video:      "retain-on-failure",
  },

  // ── Proyectos ─────────────────────────────────────────────────────────────
  projects: [
    // 1. Setup: hace login en admin y guarda el estado de auth
    {
      name: "setup",
      testMatch: /global\.setup\.js/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: ADMIN_URL,
      },
    },

    // 2. Tests del portal de clientes (sin auth)
    {
      name: "store",
      testDir: "./store",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: STORE_URL,
      },
    },

    // 3. Tests del panel de administración (usa auth state del setup)
    {
      name: "admin",
      testDir: "./admin",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: ADMIN_URL,
        storageState: "./fixtures/admin-auth.json",
      },
    },
  ],
});
