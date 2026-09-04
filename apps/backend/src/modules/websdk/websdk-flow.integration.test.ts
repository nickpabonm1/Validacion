import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/prisma";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";
import { clearCachedToken } from "../fad-adapter/token-cache";
import { startWebSdkExecution, submitAcuantResult, submitFacetecResult, completeWebSdkExecution } from "./websdk-flow.service";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function obfuscate(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) out += String.fromCharCode(value.charCodeAt(i) - 1);
  return out;
}

const AES_KEY = "0123456789abcdef0123456789abcdef"; // 32 bytes
const AES_IV = "fedcba9876543210"; // 16 bytes

// Cada Response solo se puede leer una vez: se genera una instancia nueva en cada uso.
function tokenResponse(): Response {
  return jsonResponse(200, { access_token: "tok-abc", token_type: "bearer", expires_in: 3600 });
}

const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function setupEnvironment() {
  await prisma.validationExecution.deleteMany();
  await prisma.webSdkConfig.deleteMany();
  await prisma.apiEnvironment.deleteMany();

  const environment = await prisma.apiEnvironment.create({
    data: {
      name: "Env de prueba Web SDK",
      environmentType: "UATHA",
      baseUrl: "https://fad.test.invalid",
      integrationModel: "WEB_SDK",
      basicAuthUsernameEnc: credentialEncryptionService.encrypt("basic-user"),
      basicAuthPasswordEnc: credentialEncryptionService.encrypt("basic-pass"),
      apiUsernameEnc: credentialEncryptionService.encrypt("api-user"),
      apiPasswordEnc: credentialEncryptionService.encrypt("api-pass"),
      passwordIsPreHashed: true,
    },
  });

  await prisma.webSdkConfig.create({
    data: {
      environmentId: environment.id,
      sdkBaseUrl: "https://sdk.test.invalid",
      acuantPassiveUsernameEnc: credentialEncryptionService.encrypt("acuant-user"),
      acuantPassivePasswordEnc: credentialEncryptionService.encrypt("acuant-pass"),
      acuantPassiveSubscriptionIdEnc: credentialEncryptionService.encrypt("acuant-sub"),
      sdkTokenEnc: credentialEncryptionService.encrypt("sdk-token-generation-fake"),
      checkMaxAttempts: 2,
      checkAcceptedRisk: "LOW",
      faceMatchMinConfidence: 85,
    },
  });

  clearCachedToken(environment.id);
  return environment.id;
}

describe("websdk-flow (integración): captura Acuant + Facetec orquestada por el backend", () => {
  beforeAll(async () => {
    await setupEnvironment();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rechaza iniciar una sesión Acuant sin el Token del SDK (Token generation) configurado", async () => {
    const environmentId = await setupEnvironment();
    await prisma.webSdkConfig.update({ where: { environmentId }, data: { sdkTokenEnc: null } });

    await expect(
      startWebSdkExecution(
        { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
        null,
      ),
    ).rejects.toThrow(/Token del SDK/i);
  });

  it("rechaza iniciar una sesión sobre un ambiente sin configuración Web SDK", async () => {
    const env = await prisma.apiEnvironment.create({
      data: { name: "Sin websdk", environmentType: "UATHA", baseUrl: "https://x.test", integrationModel: "WEB_SDK" },
    });
    await expect(
      startWebSdkExecution(
        { environmentId: env.id, client: { name: "Cliente", mail: "c@x.com", phone: "+573000000000" } },
        null,
      ),
    ).rejects.toThrow(/no tiene configuración Web SDK/i);
  });

  it("flujo completo: acepta el riesgo al primer intento y completa saveValidationData", async () => {
    const environmentId = await setupEnvironment();
    const fetchMock = vi
      .fn()
      // start -> getAccessToken
      .mockResolvedValueOnce(tokenResponse())
      // acuant-result -> CHECK
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, data: { risk: "LOW", key: "", result: true } }))
      // complete -> compareFacesPassive
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, data: { confidence: 97.2, qualityFace1: 90, qualityFace2: 88 } }))
      // complete -> getValidationKeys
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          error: null,
          data: { key: obfuscate(AES_KEY), vector: obfuscate(AES_IV), validationId: "vid-web-sdk-1" },
        }),
      )
      // complete -> saveValidationData
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, data: { status: "TERMINADO", porcentCompare: 97.2 } }));
    vi.stubGlobal("fetch", fetchMock);

    const { executionId, sdkInit } = await startWebSdkExecution(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      null,
    );
    expect(sdkInit.acuant.credentials.passiveUsername).toBe("acuant-user");
    expect(sdkInit.sdkEnvironment).toBe("UATHA");
    expect(sdkInit.checkMaxAttempts).toBe(2);

    const checkResult = await submitAcuantResult(executionId, {
      frontImage: `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
      backImage: `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
      idPhoto: `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
      documentInstance: "doc-1",
      ocr: { documentNumber: "0000000000", fullName: "CLIENTE DEMO" },
    });
    expect(checkResult).toMatchObject({ accepted: true, risk: "LOW", attemptsUsed: 1, exhausted: false });

    await submitFacetecResult(executionId, {
      selfie: `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
      sessionId: "session-1",
      status: 0,
    });

    const { executionId: completedId } = await completeWebSdkExecution(executionId);
    expect(completedId).toBe(executionId);

    const execution = await prisma.validationExecution.findUniqueOrThrow({ where: { id: executionId } });
    expect(execution.normalizedStatus).toBe("COMPLETED");
    expect(execution.result).toBe("APPROVED");
    expect(execution.validationId).toBe("vid-web-sdk-1");
    expect(execution.webSdkState).toBeNull();
    expect(execution.keyEncrypted).toBeTruthy();
    expect(execution.vectorEncrypted).toBeTruthy();
    expect(credentialEncryptionService.decrypt(execution.keyEncrypted!)).toBe(AES_KEY);
    expect(credentialEncryptionService.decrypt(execution.vectorEncrypted!)).toBe(AES_IV);

    const detail = JSON.parse(execution.normalizedResponse!);
    expect(detail.mediaAssets).toHaveLength(4); // frontImage, backImage, idPhoto, selfie
    expect(detail.mediaAssets.map((a: { label: string }) => a.label)).toEqual(
      expect.arrayContaining(["documentFront", "documentBack", "idPhoto", "selfie"]),
    );
    expect(detail.comparisonPercentage).toBe(97.2);

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("marca la ejecución como FAILED/REJECTED cuando NAAT-CHECK agota los intentos", async () => {
    const environmentId = await setupEnvironment();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, data: { risk: "HIGH", key: "TAMP_FOTO_RISK", result: false } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, data: { risk: "HIGH", key: "TAMP_FOTO_RISK", result: false } }));
    vi.stubGlobal("fetch", fetchMock);

    const { executionId } = await startWebSdkExecution(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      null,
    );

    const attempt1 = await submitAcuantResult(executionId, { frontImage: `data:image/png;base64,${SAMPLE_PNG_BASE64}` });
    expect(attempt1).toMatchObject({ accepted: false, attemptsUsed: 1, exhausted: false });

    const attempt2 = await submitAcuantResult(executionId, { frontImage: `data:image/png;base64,${SAMPLE_PNG_BASE64}` });
    expect(attempt2).toMatchObject({ accepted: false, attemptsUsed: 2, exhausted: true });

    const execution = await prisma.validationExecution.findUniqueOrThrow({ where: { id: executionId } });
    expect(execution.normalizedStatus).toBe("FAILED");
    expect(execution.result).toBe("REJECTED");
  });

  it("rechaza completar la validación si el match facial no alcanza el umbral configurado", async () => {
    const environmentId = await setupEnvironment();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, data: { risk: "LOW", key: "", result: true } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, data: { confidence: 40, qualityFace1: 90, qualityFace2: 88 } }));
    vi.stubGlobal("fetch", fetchMock);

    const { executionId } = await startWebSdkExecution(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      null,
    );
    await submitAcuantResult(executionId, {
      frontImage: `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
      idPhoto: `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
    });
    await submitFacetecResult(executionId, { selfie: `data:image/png;base64,${SAMPLE_PNG_BASE64}` });

    await expect(completeWebSdkExecution(executionId)).rejects.toThrow(/match facial/i);

    const execution = await prisma.validationExecution.findUniqueOrThrow({ where: { id: executionId } });
    expect(execution.normalizedStatus).toBe("FAILED");
    expect(execution.result).toBe("REJECTED");
  });
});

async function setupRegulaEnvironment() {
  await prisma.validationExecution.deleteMany();
  await prisma.webSdkConfig.deleteMany();
  await prisma.apiEnvironment.deleteMany();

  const environment = await prisma.apiEnvironment.create({
    data: {
      name: "Env de prueba Web SDK (Regula)",
      environmentType: "UATHA",
      baseUrl: "https://fad.test.invalid",
      integrationModel: "WEB_SDK",
      basicAuthUsernameEnc: credentialEncryptionService.encrypt("basic-user"),
      basicAuthPasswordEnc: credentialEncryptionService.encrypt("basic-pass"),
      apiUsernameEnc: credentialEncryptionService.encrypt("api-user"),
      apiPasswordEnc: credentialEncryptionService.encrypt("api-pass"),
      passwordIsPreHashed: true,
    },
  });

  await prisma.webSdkConfig.create({
    data: {
      environmentId: environment.id,
      sdkBaseUrl: "https://sdk.test.invalid",
      documentCaptureEngine: "REGULA",
      regulaLicenseEnc: credentialEncryptionService.encrypt("regula-license-base64"),
      regulaApiBasePath: "https://interno.test.invalid/regula",
      regulaCaptureType: "CAMERA_SNAPSHOT",
      sdkTokenEnc: credentialEncryptionService.encrypt("sdk-token-generation-fake"),
      checkMaxAttempts: 2,
      checkAcceptedRisk: "LOW",
      faceMatchMinConfidence: 85,
    },
  });

  clearCachedToken(environment.id);
  return environment.id;
}

describe("websdk-flow (integración): motor de captura Regula", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("arma sdkInit.regula (no sdkInit.acuant) con las credenciales de Regula del ambiente", async () => {
    const environmentId = await setupRegulaEnvironment();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(tokenResponse()));

    const { sdkInit } = await startWebSdkExecution(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      null,
    );

    expect(sdkInit.documentCaptureEngine).toBe("REGULA");
    expect(sdkInit.acuant).toBeUndefined();
    expect(sdkInit.regula).toMatchObject({
      credentials: { license: "regula-license-base64", apiBasePath: "https://interno.test.invalid/regula" },
      idData: true,
      idPhoto: true,
      captureType: "CAMERA_SNAPSHOT",
    });
  });

  it("rechaza iniciar una sesión Regula sin licencia/apiBasePath configurados", async () => {
    const environmentId = await setupRegulaEnvironment();
    await prisma.webSdkConfig.update({ where: { environmentId }, data: { regulaLicenseEnc: null } });

    await expect(
      startWebSdkExecution(
        { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
        null,
      ),
    ).rejects.toThrow(/licencia.*apiBasePath.*Regula/i);
  });

  it("rechaza iniciar una sesión Regula sin el Token del SDK (Token generation) configurado", async () => {
    const environmentId = await setupRegulaEnvironment();
    await prisma.webSdkConfig.update({ where: { environmentId }, data: { sdkTokenEnc: null } });

    await expect(
      startWebSdkExecution(
        { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
        null,
      ),
    ).rejects.toThrow(/Token del SDK/i);
  });
});

async function setupCaptureIdEnvironment() {
  await prisma.validationExecution.deleteMany();
  await prisma.webSdkConfig.deleteMany();
  await prisma.apiEnvironment.deleteMany();

  const environment = await prisma.apiEnvironment.create({
    data: {
      name: "Env de prueba Web SDK (CaptureId)",
      environmentType: "UATHA",
      baseUrl: "https://fad.test.invalid",
      integrationModel: "WEB_SDK",
      basicAuthUsernameEnc: credentialEncryptionService.encrypt("basic-user"),
      basicAuthPasswordEnc: credentialEncryptionService.encrypt("basic-pass"),
      apiUsernameEnc: credentialEncryptionService.encrypt("api-user"),
      apiPasswordEnc: credentialEncryptionService.encrypt("api-pass"),
      passwordIsPreHashed: true,
    },
  });

  await prisma.webSdkConfig.create({
    data: {
      environmentId: environment.id,
      sdkBaseUrl: "https://sdk.test.invalid",
      documentCaptureEngine: "CAPTURE_ID",
      captureIdParams: JSON.stringify({ idPhoto: true, originalPhoto: true }),
      captureIdConfiguration: JSON.stringify({ views: { instructions: true }, output: { idData: true } }),
      checkMaxAttempts: 2,
      checkAcceptedRisk: "LOW",
      faceMatchMinConfidence: 85,
    },
  });

  clearCachedToken(environment.id);
  return environment.id;
}

describe("websdk-flow (integración): motor de captura CaptureId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("arma sdkInit.captureId (sin credentials) inyectando captureIdParams en configuration.output", async () => {
    const environmentId = await setupCaptureIdEnvironment();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(tokenResponse()));

    const { sdkInit } = await startWebSdkExecution(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      null,
    );

    expect(sdkInit.documentCaptureEngine).toBe("CAPTURE_ID");
    expect(sdkInit.acuant).toBeUndefined();
    expect(sdkInit.regula).toBeUndefined();
    expect(sdkInit.captureId).toMatchObject({
      configuration: {
        views: { instructions: true },
        // `output.idData` (de la configuración base) se preserva; idPhoto/originalPhoto vienen
        // de captureIdParams y no se pierden aunque no estuvieran ya en `output`.
        output: { idData: true, idPhoto: true, originalPhoto: true },
      },
    });
  });

  it("no exige credenciales propias para iniciar una sesión CaptureId (usa el sdkToken/access_token)", async () => {
    const environmentId = await setupCaptureIdEnvironment();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(tokenResponse()));

    const { sdkInit } = await startWebSdkExecution(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      null,
    );
    expect(sdkInit.sdkToken).toBe("tok-abc"); // fallback al access_token: no se configuró sdkTokenEnc
  });
});

describe("websdk-flow (integración): una plantilla Web SDK sobreescribe tema/umbrales de esta ejecución", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sdkInit.checkMaxAttempts y el tema de acuant reflejan la plantilla, no el ambiente", async () => {
    const environmentId = await setupEnvironment();
    const template = await prisma.webSdkTemplate.create({
      data: {
        name: "Onboarding estricto",
        environmentId,
        checkMaxAttempts: 1,
        customization: JSON.stringify({ colors: { primary: "#ff0000" } }),
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(tokenResponse()));

    const { sdkInit } = await startWebSdkExecution(
      {
        environmentId,
        webSdkTemplateId: template.id,
        client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" },
      },
      null,
    );

    expect(sdkInit.checkMaxAttempts).toBe(1); // la plantilla dice 1, el ambiente dice 2
    expect(sdkInit.acuant?.configuration).toMatchObject({ customization: { fadCustomization: { colors: { primary: "#ff0000" } } } });
  });

  it("submitAcuantResult usa el umbral de riesgo/intentos de la plantilla, no del ambiente", async () => {
    const environmentId = await setupEnvironment();
    const template = await prisma.webSdkTemplate.create({
      data: { name: "Un solo intento", environmentId, checkMaxAttempts: 1 },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, data: { risk: "HIGH", key: "TAMP_FOTO_RISK", result: false } }));
    vi.stubGlobal("fetch", fetchMock);

    const { executionId } = await startWebSdkExecution(
      {
        environmentId,
        webSdkTemplateId: template.id,
        client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" },
      },
      null,
    );

    // El ambiente permite 2 intentos, pero la plantilla dice 1: se agota en el primero.
    const attempt1 = await submitAcuantResult(executionId, { frontImage: `data:image/png;base64,${SAMPLE_PNG_BASE64}` });
    expect(attempt1).toMatchObject({ accepted: false, attemptsUsed: 1, attemptsMax: 1, exhausted: true });
  });

  it("sin plantilla, el comportamiento sigue siendo exactamente el del ambiente (sin cambios)", async () => {
    const environmentId = await setupEnvironment();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(tokenResponse()));

    const { sdkInit } = await startWebSdkExecution(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      null,
    );
    expect(sdkInit.checkMaxAttempts).toBe(2);
    expect(sdkInit.acuant?.configuration).toEqual({});
  });

  it("rechaza una plantilla que no pertenece al ambiente indicado", async () => {
    const environmentId = await setupEnvironment();
    const otherEnvironment = await prisma.apiEnvironment.create({
      data: { name: "Otro ambiente", environmentType: "UATHA", baseUrl: "https://otro.test.invalid", integrationModel: "WEB_SDK" },
    });
    const foreignTemplate = await prisma.webSdkTemplate.create({
      data: { name: "De otro ambiente", environmentId: otherEnvironment.id },
    });

    await expect(
      startWebSdkExecution(
        {
          environmentId,
          webSdkTemplateId: foreignTemplate.id,
          client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" },
        },
        null,
      ),
    ).rejects.toThrow(/no existe o no pertenece/i);
  });
});
