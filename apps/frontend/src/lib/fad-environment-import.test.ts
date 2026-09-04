import { describe, expect, it } from "vitest";
import { extractExportedObjectLiteral, parseFadEnvironmentImport, parseFadEnvironmentObject } from "./fad-environment-import";

/** Mismo shape que el `environment.ts` de los proyectos de ejemplo del proveedor (fad-demo-v1/v2),
 * pero con valores 100% ficticios — nunca credenciales reales. */
const SAMPLE_ENVIRONMENT_TS = `
/**
 * Configuración del entorno de DESARROLLO.
 */
import { FadConfig } from '../app/models/fad-config.model';

export const environment: FadConfig = {
  production: false,

  api: {
    baseUrl: '/fad-api',
  },

  auth: {
    tokenPath: '/authorization-server/oauth/token',
    basic: {
      clientId: 'ZmFrZS1jbGllbnQtaWQ=',
      clientSecret: 'ZmFrZS1jbGllbnQtc2VjcmV0LWZvci10ZXN0cw==',
    },
    user: {
      username: 'soporte.demo@ejemplo-ficticio.com.co',
      password: 'aaaa0000bbbb1111cccc2222dddd3333eeee4444ffff5555',
      passwordIsHashed: true,
      grantType: 'password',
    },
  },

  sdk: {
    environment: 'UATHA',
    baseUrl: 'https://uathaapiframe.firmaautografa.com',
    requestId: '',
    // token de ejemplo, ficticio
    token: 'ZmFrZS1zZGstdG9rZW4tZm9yLXRlc3RzLW9ubHk=',
  },

  acuant: {
    credentials: {
      passiveUsername: 'acuantFakeUser@example.com',
      passivePassword: 'Fake#Password123',
      passiveSubscriptionId: '00000000-0000-0000-0000-000000000000',
      acasEndpoint: 'https://eu.acas.acuant.net',
      livenessEndpoint: 'https://eu.passlive.acuant.net',
      assureidEndpoint: 'https://eu.assureid.acuant.net',
    },
    params: {
      idData: true, // extraer OCR
      idPhoto: true,
      manualCapture: false,
    },
  },

  regula: {
    credentials: {
      license: 'ZmFrZS1yZWd1bGEtbGljZW5zZS1mb3ItdGVzdHM=',
      apiBasePath: 'https://test-regula.firmaautografa.com',
    },
    params: {
      idData: true,
      idPhoto: true,
      captureType: 'DOCUMENT_READER',
    },
  },

  facetec: {
    useMiddleware: true,
    credentials: {
      deviceKeyIdentifier: '',
      baseURL: '',
      publicFaceScanEncryptionKey: '',
      productionKeyText: {
        domains: '',
        expiryDate: '',
        key: '',
      },
    },
  },
};
`;

describe("fad-environment-import: extractExportedObjectLiteral", () => {
  it("extrae el objeto exportado, ignorando las llaves del import previo", () => {
    const literal = extractExportedObjectLiteral(SAMPLE_ENVIRONMENT_TS);
    expect(literal).toBeTruthy();
    expect(literal!.startsWith("{")).toBe(true);
    expect(literal!.endsWith("}")).toBe(true);
    expect(literal).toContain("clientId");
    expect(literal).not.toContain("import {");
  });

  it("devuelve null si no hay un export const/default reconocible", () => {
    expect(extractExportedObjectLiteral("const x = 1;")).toBeNull();
  });
});

describe("fad-environment-import: parseFadEnvironmentObject", () => {
  it("interpreta comillas simples, claves sin comillas, comentarios y comas finales (JSON5)", () => {
    const obj = parseFadEnvironmentObject(SAMPLE_ENVIRONMENT_TS) as {
      auth: { basic: { clientId: string } };
      sdk: { token: string };
    };
    expect(obj).toBeTruthy();
    expect(obj.auth.basic.clientId).toBe("ZmFrZS1jbGllbnQtaWQ=");
    expect(obj.sdk.token).toBe("ZmFrZS1zZGstdG9rZW4tZm9yLXRlc3RzLW9ubHk=");
  });

  it("devuelve null para un archivo que no es un environment.ts del proveedor", () => {
    expect(parseFadEnvironmentObject("export default 42;")).toBeNull();
    expect(parseFadEnvironmentObject("hola mundo")).toBeNull();
  });
});

describe("fad-environment-import: parseFadEnvironmentImport", () => {
  it("mapea auth/sdk/acuant/regula a los campos planos de ambiente y Web SDK", () => {
    const result = parseFadEnvironmentImport(SAMPLE_ENVIRONMENT_TS);

    expect(result.environmentValues).toMatchObject({
      basicAuthUsername: "ZmFrZS1jbGllbnQtaWQ=",
      basicAuthPassword: "ZmFrZS1jbGllbnQtc2VjcmV0LWZvci10ZXN0cw==",
      apiUsername: "soporte.demo@ejemplo-ficticio.com.co",
      apiPassword: "aaaa0000bbbb1111cccc2222dddd3333eeee4444ffff5555",
      passwordIsPreHashed: true,
      grantType: "password",
    });

    expect(result.webSdkValues).toMatchObject({
      sdkToken: "ZmFrZS1zZGstdG9rZW4tZm9yLXRlc3RzLW9ubHk=",
      sdkBaseUrl: "https://uathaapiframe.firmaautografa.com",
      acuantPassiveUsername: "acuantFakeUser@example.com",
      acuantPassivePassword: "Fake#Password123",
      acuantPassiveSubscriptionId: "00000000-0000-0000-0000-000000000000",
      regulaLicense: "ZmFrZS1yZWd1bGEtbGljZW5zZS1mb3ItdGVzdHM=",
      regulaApiBasePath: "https://test-regula.firmaautografa.com",
      facetecUseMiddleware: true,
    });

    // Los campos de Facetec vacíos ('') no deben aplicarse como si fueran un valor real.
    expect(result.webSdkValues.facetecDeviceKeyIdentifier).toBeUndefined();
    expect(result.webSdkValues.facetecProductionKeyText).toBeUndefined();

    expect(result.matched.length).toBeGreaterThan(5);
    expect(result.warnings).toHaveLength(0);
  });

  it("no revienta y avisa con un archivo irreconocible", () => {
    const result = parseFadEnvironmentImport("esto no es un environment.ts");
    expect(result.environmentValues).toEqual({});
    expect(result.webSdkValues).toEqual({});
    expect(result.matched).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("ignora campos con formato inválido en vez de aplicarlos a la fuerza", () => {
    const badFile = `
      export const environment = {
        auth: { basic: { clientId: 123 } }, // debería ser string
      };
    `;
    const result = parseFadEnvironmentImport(badFile);
    expect(result.environmentValues.basicAuthUsername).toBeUndefined();
    expect(result.warnings.some((w) => w.includes("basicAuthUsername"))).toBe(true);
  });
});
