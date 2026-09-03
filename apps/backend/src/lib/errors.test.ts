import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import { errorHandler } from "./errors";

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe("errorHandler — detección de ZodError", () => {
  it("responde 400 para un ZodError real (instanceof)", () => {
    const err = new ZodError([{ code: "custom", path: ["campo"], message: "inválido" }]);
    const res = mockRes();
    errorHandler(err, {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  /** Reproduce el bug real encontrado en pruebas: los esquemas Zod de
   * `@fad-console/validation-schemas` (paquete del monorepo) pueden terminar en una instancia de
   * `ZodError` de una copia distinta del paquete `zod` que la que carga este archivo — confirmado
   * con `POST /api/clients` con un `name` vacío devolviendo 500 en vez de 400 antes de este fix.
   * El objeto de abajo simula esa segunda copia: misma forma (`name`/`issues`), pero NO es
   * `instanceof` el `ZodError` importado aquí. */
  it("responde 400 para un objeto con forma de ZodError de otra copia del paquete zod (no instanceof)", () => {
    const foreignZodError = Object.assign(new Error("[]"), {
      name: "ZodError",
      issues: [{ path: ["to"], message: "Invalid email" }],
    });
    expect(foreignZodError).not.toBeInstanceOf(ZodError);

    const res = mockRes();
    errorHandler(foreignZodError, { path: "/api/test" } as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "VALIDATION_ERROR" }) }),
    );
  });

  it("un error genérico sigue respondiendo 500", () => {
    const res = mockRes();
    errorHandler(new Error("boom"), { path: "/api/test" } as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
