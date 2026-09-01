import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@demo.local";
const ADMIN_PASSWORD = "Demo#Local2026!";

test.describe("Autenticación", () => {
  test("rechaza credenciales incorrectas y permite iniciar sesión con las correctas", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", "contraseña-incorrecta");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/correo o contraseña incorrectos/i)).toBeVisible();

    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  });

  test("protege rutas privadas y redirige a /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/executions");
    await expect(page).toHaveURL(/\/login/);
  });

  test("permite cerrar sesión", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
