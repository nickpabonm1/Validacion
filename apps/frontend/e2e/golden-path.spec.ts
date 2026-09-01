import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./utils";

const RUN_ID = Date.now();
const ENV_NAME = `E2E Ambiente ${RUN_ID}`;
const TEMPLATE_NAME = `E2E Plantilla ${RUN_ID}`;
const PROCESS_NAME = `E2E Proceso ${RUN_ID}`;

test.describe.configure({ mode: "serial" });

test.describe("Flujo completo (golden path)", () => {
  test("crear ambiente, construir plantilla, ejecutar en modo demo, consultar y ver auditoría", async ({ page }) => {
    await loginAsAdmin(page);

    await test.step("Crear ambiente", async () => {
      await page.goto("/environments");
      await page.getByRole("button", { name: "Nueva conexión" }).click();
      await page.fill("#name", ENV_NAME);
      await page.fill("#baseUrl", "https://fad-e2e.example.invalid");
      await page.getByRole("button", { name: "Crear ambiente" }).click();
      await expect(page.getByText("Ambiente creado").first()).toBeVisible();
      await expect(page.locator(`button:has-text("${ENV_NAME}")`)).toBeVisible();
    });

    await test.step("Construir plantilla: pasos, formulario dinámico y tema", async () => {
      await page.goto("/builder");
      await page.getByRole("button", { name: "Agregar paso Ubicación" }).click();
      await page.getByRole("button", { name: "Agregar paso Aviso de privacidad" }).click();
      await page.getByRole("button", { name: "Agregar paso Formulario de validación" }).click();

      // Formulario dinámico: seleccionar el paso y agregar un formulario + campo
      await page.locator('button:has-text("Formulario de validación")').click();
      await page.getByRole("button", { name: "Agregar formulario" }).click();
      await page.getByRole("button", { name: "Agregar campo" }).click();

      // Datos generales (obligatorios para validar el contrato)
      await page.getByRole("tab", { name: "General" }).click();
      await page.fill("#processName", PROCESS_NAME);
      await page.fill("#clientName", "Cliente E2E Golden Path");
      await page.fill("#clientMail", "golden-path@example.com");
      await page.fill("#clientPhone", "+573000000123");

      // Tema visual
      await page.getByRole("tab", { name: "Tema" }).click();
      await page.getByPlaceholder("#005b95").fill("#123456");

      // Revisar JSON y validar contrato
      await page.getByRole("tab", { name: "JSON" }).click();
      await page.getByRole("button", { name: "Validar contrato" }).click();
      await expect(page.getByText(/el contrato es válido/i)).toBeVisible();

      // Guardar como plantilla
      await page.getByRole("button", { name: "Guardar como plantilla" }).click();
      await page.fill("#tpl-name", TEMPLATE_NAME);
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(page.getByText("Plantilla creada").first()).toBeVisible();
    });

    let executionUrl = "";

    await test.step("Ejecutar validación en modo demostración", async () => {
      await page.goto("/executions/new");
      await page.locator(`button:has-text("${ENV_NAME}")`).click();
      await page.getByRole("button", { name: "Siguiente" }).click();

      await page.locator(`button:has-text("${TEMPLATE_NAME}")`).click();
      await page.getByRole("button", { name: "Siguiente" }).click();
      await page.getByRole("button", { name: "Siguiente" }).click(); // cliente ya viene de la plantilla
      await page.getByRole("button", { name: "Siguiente" }).click(); // revisión
      await page.getByRole("button", { name: "Siguiente" }).click(); // json final

      await expect(page.getByText(/debes configurar una conexión api/i)).toBeVisible();
      await page.getByRole("button", { name: "Simular en modo DEMO" }).click();
      await expect(page.getByText("Ejecución simulada (DEMO)").first()).toBeVisible();

      await page.getByRole("button", { name: "Ver detalle de la validación" }).click();
      await page.waitForURL(/\/executions\/.+/);
      executionUrl = page.url();
      await expect(page.getByText(PROCESS_NAME)).toBeVisible();
    });

    await test.step("Consultar estado de la validación", async () => {
      await page.goto(executionUrl);
      await page.getByRole("button", { name: "Consultar estado" }).click();
      await expect(page.getByText("Completada")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Aprobado")).toBeVisible();
    });

    await test.step("Verificar vista de respuesta configurable en el detalle", async () => {
      await expect(page.getByRole("tab", { name: "Resumen" })).toBeVisible();
      await page.getByRole("tab", { name: "Pasos" }).click();
      await expect(page.getByText("location").first()).toBeVisible();
    });

    await test.step("Verificar historial de validaciones", async () => {
      await page.goto("/executions");
      await page.fill('input[placeholder*="Buscar"]', PROCESS_NAME);
      await expect(page.getByText(PROCESS_NAME)).toBeVisible();
    });

    await test.step("Ver auditoría", async () => {
      await page.goto("/audit");
      await expect(page.locator("tbody").getByText("EXECUTE_VALIDATION").first()).toBeVisible();
    });
  });
});
