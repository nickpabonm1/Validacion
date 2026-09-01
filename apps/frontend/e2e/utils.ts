import type { Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@demo.local";
export const ADMIN_PASSWORD = "Demo#Local2026!";

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
}
