import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./utils";

test.describe("Webhooks", () => {
  test("recibe un evento y lo muestra en el listado", async ({ page, request }) => {
    const eventId = `e2e-webhook-${Date.now()}`;
    const response = await request.post("http://localhost:4000/api/webhooks/fad", {
      data: {
        id: eventId,
        idUser: "e2e-user",
        event: "VALIDATION_CHANGE_STATUS",
        creationDate: "01/01/2026 10:00:00",
        data: { validationId: "e2e-nonexistent-validation", result: "Aprobado", status: "Terminado" },
        retry: 0,
        error: "",
        idOriginal: null,
      },
    });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.received).toBe(true);

    await loginAsAdmin(page);
    await page.goto("/webhooks");
    await expect(page.getByText("VALIDATION_CHANGE_STATUS").first()).toBeVisible();
  });

  test("es idempotente ante el mismo id de evento", async ({ request }) => {
    const eventId = `e2e-webhook-dup-${Date.now()}`;
    const payload = {
      id: eventId,
      idUser: "e2e-user",
      event: "CREATED_VALIDATION_STEP",
      creationDate: "01/01/2026 10:00:00",
      data: { key: "k", vector: "v", validationId: "e2e-nonexistent" },
      retry: 0,
      error: "",
      idOriginal: null,
    };
    const first = await request.post("http://localhost:4000/api/webhooks/fad", { data: payload });
    const second = await request.post("http://localhost:4000/api/webhooks/fad", { data: payload });
    expect((await first.json()).status).not.toBe("DUPLICATE");
    expect((await second.json()).status).toBe("DUPLICATE");
  });
});
