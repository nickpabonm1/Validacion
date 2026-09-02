import { describe, expect, it } from "vitest";
import { parsePostmanCollection } from "./postman-import";

function collection(overrides: Record<string, unknown> = {}) {
  return {
    info: { name: "FAD-BIOMETRICS-ValidationSteps Autentic COL UATHA" },
    variable: [{ key: "baseUrl", value: "https://uatha.firmaautografa.com" }],
    item: [
      {
        name: "Autenticación",
        request: {
          method: "POST",
          url: "{{baseUrl}}/authorization-server/oauth/token",
          header: [{ key: "Content-Type", value: "application/x-www-form-urlencoded" }],
          auth: {
            type: "basic",
            basic: [
              { key: "username", value: "clientuser" },
              { key: "password", value: "clientpass" },
            ],
          },
          body: {
            mode: "urlencoded",
            urlencoded: [
              { key: "grant_type", value: "password" },
              { key: "username", value: "apiuser" },
              { key: "password", value: "apipass" },
            ],
          },
        },
      },
      {
        name: "Carpeta de validaciones",
        item: [
          {
            name: "createValidation Autentic AF",
            request: { method: "POST", url: "{{baseUrl}}/biometrics-by-steps/validations" },
          },
          {
            name: "getValidationStep",
            request: { method: "GET", url: "{{baseUrl}}/validation/getValidationStep/:validationId" },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("parsePostmanCollection", () => {
  it("extrae baseUrl, endpoints y credenciales de una colección típica de FAD", () => {
    const result = parsePostmanCollection(collection());

    expect(result.values.baseUrl).toBe("https://uatha.firmaautografa.com");
    expect(result.values.authTokenEndpoint).toBe("/authorization-server/oauth/token");
    expect(result.values.createValidationEndpoint).toBe("/biometrics-by-steps/validations");
    expect(result.values.getValidationStepEndpoint).toBe("/validation/getValidationStep/{validationId}");
    expect(result.values.getValidationStepHttpMethod).toBe("GET");
    expect(result.values.basicAuthUsername).toBe("clientuser");
    expect(result.values.basicAuthPassword).toBe("clientpass");
    expect(result.values.apiUsername).toBe("apiuser");
    expect(result.values.apiPassword).toBe("apipass");
    expect(result.values.grantType).toBe("password");
    expect(result.warnings.some((w) => w.includes("Basic Auth"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("API"))).toBe(true);
  });

  it("decodifica credenciales Basic Auth desde el header Authorization cuando no hay auth.basic", () => {
    const raw = collection();
    // Base64 de "clientuser:clientpass"
    const authRequest = (raw.item[0] as { request: { auth?: unknown; header: { key: string; value: string }[] } }).request;
    authRequest.auth = undefined;
    authRequest.header.push({ key: "Authorization", value: "Basic Y2xpZW50dXNlcjpjbGllbnRwYXNz" });

    const result = parsePostmanCollection(raw);
    expect(result.values.basicAuthUsername).toBe("clientuser");
    expect(result.values.basicAuthPassword).toBe("clientpass");
  });

  it("lanza un error claro si el archivo no tiene `item` (p. ej. un archivo de Environment)", () => {
    expect(() => parsePostmanCollection({ values: [{ key: "baseUrl", value: "https://x.test" }] })).toThrow(
      /Environment/,
    );
  });

  it("lanza un error si el archivo no es un objeto", () => {
    expect(() => parsePostmanCollection("no-json")).toThrow();
  });

  it("agrega una advertencia cuando quedan variables sin resolver", () => {
    const raw = collection({ variable: [] });
    const result = parsePostmanCollection(raw);
    // Sin la variable baseUrl declarada, la URL resuelta sigue conteniendo "{{baseUrl}}"
    expect(result.warnings.some((w) => w.includes("sin resolver"))).toBe(true);
  });

  it("detecta el tipo de ambiente a partir del nombre de la colección", () => {
    const prod = parsePostmanCollection(collection({ info: { name: "FAD PRODUCTION" } }));
    expect(prod.values.environmentType).toBe("PRODUCTION");

    const qa = parsePostmanCollection(collection({ info: { name: "FAD QA" } }));
    expect(qa.values.environmentType).toBe("QA");
  });
});
