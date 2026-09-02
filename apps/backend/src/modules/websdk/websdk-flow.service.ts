import type {
  WebSdkSessionInitDto,
  WebSdkCheckResultDto,
  DocumentCaptureEngine,
  BiometricEngine,
} from "@fad-console/shared-types";
import type {
  WebSdkStartInput,
  WebSdkAcuantResultInput,
  WebSdkFacetecResultInput,
} from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";
import { fadApiAdapter } from "../fad-adapter/fad-api-adapter";
import { joinUrl } from "../fad-adapter/url";
import { getEnvironmentOrThrow } from "../environments/environments.service";
import { maskEmail, maskName } from "../../normalize/mask";
import { getWebSdkConfig, decryptWebSdkCredentials } from "./websdk-config.service";
import { buildFadFile, deobfuscateFadKey } from "./websdk-crypto";
import { buildTar, type TarEntry } from "./tar-writer";
import { dataUriToBuffer, stripDataUri } from "./image-util";
import { buildMetadataJson, buildWebSdkNormalizedDetail } from "./websdk-normalize";

/** Estado transitorio del flujo mientras se ejecuta (ver `ValidationExecution.webSdkState`). Se
 * limpia (a null) una vez `completeWebSdkExecution` termina con éxito. */
interface WebSdkState {
  checkAttempts: number;
  acuant?: WebSdkAcuantResultInput;
  facetec?: WebSdkFacetecResultInput;
  check?: { risk: string; key: string; result?: boolean };
}

function emptyState(): WebSdkState {
  return { checkAttempts: 0 };
}

async function loadEnvironmentAndConfig(environmentId: string) {
  const environment = await getEnvironmentOrThrow(environmentId);
  if (environment.integrationModel !== "WEB_SDK") {
    throw AppError.badRequest("Este ambiente no está configurado para el modelo de integración Web SDK.");
  }
  const config = await getWebSdkConfig(environmentId);
  if (!config) {
    throw AppError.badRequest(
      "Este ambiente no tiene configuración Web SDK. Ve a Ambientes > pestaña «Web SDK» y complétala.",
    );
  }
  return { environment, config };
}

function injectMiddlewareToken(middleware: Record<string, unknown>, accessToken: string): Record<string, unknown> {
  const existingCredentials = (middleware.credentials as Record<string, unknown> | undefined) ?? {};
  if (existingCredentials.token || existingCredentials.user) return { ...middleware, credentials: existingCredentials };
  return { ...middleware, credentials: { ...existingCredentials, token: accessToken } };
}

async function getExecutionRowOrThrow(executionId: string) {
  const execution = await prisma.validationExecution.findUnique({
    where: { id: executionId },
    include: { environment: true, template: true },
  });
  if (!execution) throw AppError.notFound("Ejecución no encontrada");
  return execution;
}

type WebSdkConfigRow = Awaited<ReturnType<typeof getWebSdkConfig>>;

/** Arma todo lo que el navegador necesita para arrancar los SDKs de Acuant/Facetec para una
 * ejecución YA creada. Separado de `startWebSdkExecution` para poder re-generar un `sdkInit`
 * fresco (access_token nuevo) sin duplicar la ejecución — usado tanto al crearla como al
 * re-abrir un enlace compartido (ver websdk-share.service.ts). Nunca se envía al navegador el
 * client_secret OAuth ni el password de la API: el backend obtiene un access_token de corta vida
 * y lo inyecta donde el SDK lo requiera. */
async function buildSdkInit(
  executionId: string,
  environment: Awaited<ReturnType<typeof getEnvironmentOrThrow>>,
  config: NonNullable<WebSdkConfigRow>,
): Promise<WebSdkSessionInitDto> {
  const creds = decryptWebSdkCredentials(config);

  if (!creds.acuantPassiveUsername || !creds.acuantPassivePassword || !creds.acuantPassiveSubscriptionId) {
    throw AppError.badRequest(
      "Configura las credenciales de Acuant en Ambientes > Web SDK antes de iniciar una captura.",
    );
  }
  if (!config.facetecUseMiddleware) {
    if (
      !creds.facetecDeviceKeyIdentifier ||
      !creds.facetecPublicFaceScanEncryptionKey ||
      !creds.facetecProductionKeyText
    ) {
      throw AppError.badRequest(
        "Configura las credenciales directas de Facetec (o activa el middleware) en Ambientes > Web SDK.",
      );
    }
  }

  const accessToken = await fadApiAdapter.getAccessToken(environment);

  return {
    executionId,
    sdkToken: creds.sdkToken || accessToken,
    sdkEnvironment: environment.environmentType === "PRODUCTION" ? "PROD" : "UATHA",
    sdkBaseUrl: config.sdkBaseUrl,
    sdkRequestId: config.sdkRequestId,
    documentCaptureEngine: config.documentCaptureEngine as DocumentCaptureEngine,
    acuant: {
      credentials: {
        passiveUsername: creds.acuantPassiveUsername,
        passivePassword: creds.acuantPassivePassword,
        passiveSubscriptionId: creds.acuantPassiveSubscriptionId,
        acasEndpoint: config.acuantAcasEndpoint,
        livenessEndpoint: config.acuantLivenessEndpoint,
        assureidEndpoint: config.acuantAssureidEndpoint,
      },
      params: fromJsonField(config.acuantParams, { idData: true, idPhoto: true, manualCapture: false }),
      configuration: fromJsonField(config.acuantConfiguration, {}),
    },
    biometricEngine: config.biometricEngine as BiometricEngine,
    facetec: {
      useMiddleware: config.facetecUseMiddleware,
      middleware: config.facetecUseMiddleware
        ? injectMiddlewareToken(fromJsonField(config.facetecMiddleware, {}), accessToken)
        : null,
      credentials: config.facetecUseMiddleware
        ? null
        : {
            deviceKeyIdentifier: creds.facetecDeviceKeyIdentifier!,
            publicFaceScanEncryptionKey: creds.facetecPublicFaceScanEncryptionKey!,
            productionKeyText: creds.facetecProductionKeyText!,
          },
      configuration: fromJsonField(config.facetecConfiguration, {}),
    },
    checkMaxAttempts: config.checkMaxAttempts,
  };
}

/** Paso 1: crea la ejecución y arma todo lo que el navegador necesita para arrancar los SDKs de
 * Acuant/Facetec. */
export async function startWebSdkExecution(
  input: WebSdkStartInput,
  userId: string | null,
): Promise<{ executionId: string; sdkInit: WebSdkSessionInitDto }> {
  const { environment, config } = await loadEnvironmentAndConfig(input.environmentId);

  const templateName = input.templateId
    ? ((await prisma.validationTemplate.findUnique({ where: { id: input.templateId } }))?.name ?? null)
    : null;

  const execution = await prisma.validationExecution.create({
    data: {
      validationId: null,
      processName: input.processName ?? templateName ?? "Onboarding Web SDK",
      environmentId: environment.id,
      templateId: input.templateId ?? null,
      requestPayload: toJsonField({ client: input.client, integrationModel: "WEB_SDK" }),
      responsePayload: null,
      normalizedResponse: null,
      rawStatus: null,
      normalizedStatus: "IN_PROGRESS",
      result: null,
      clientNameMasked: maskName(input.client.name),
      clientEmailMasked: maskEmail(input.client.mail),
      isDemo: false,
      startedAt: new Date(),
      createdById: userId,
      webSdkState: toJsonField(emptyState()),
    },
  });

  const sdkInit = await buildSdkInit(execution.id, environment, config);
  return { executionId: execution.id, sdkInit };
}

/** Re-genera el `sdkInit` (access_token fresco) de una ejecución Web SDK ya creada — usado por el
 * flujo de enlace compartido cuando el cliente abre `/v/:token` (la ejecución se crea al iniciar
 * el enlace; ver websdk-share.service.ts). */
export async function getSdkInitForExecution(executionId: string): Promise<WebSdkSessionInitDto> {
  const execution = await getExecutionRowOrThrow(executionId);
  const config = await getWebSdkConfig(execution.environmentId);
  if (!config) throw AppError.badRequest("Este ambiente no tiene configuración Web SDK.");
  return buildSdkInit(executionId, execution.environment, config);
}

interface FadServiceResponse<T> {
  success?: boolean;
  error?: string | null;
  code?: number | null;
  data?: T | null;
}

/** Paso 2: recibe el resultado de `startAcuant()` y ejecuta NAAT-CHECK server-side (con la
 * lógica de reintentos de docs/Integration_saveValidationData_service.pdf / fad-demo-v1). */
export async function submitAcuantResult(
  executionId: string,
  input: WebSdkAcuantResultInput,
): Promise<WebSdkCheckResultDto> {
  const execution = await getExecutionRowOrThrow(executionId);
  const config = await getWebSdkConfig(execution.environmentId);
  if (!config) throw AppError.badRequest("Este ambiente no tiene configuración Web SDK.");
  const state = fromJsonField<WebSdkState>(execution.webSdkState, emptyState());

  const accessToken = await fadApiAdapter.getAccessToken(execution.environment);
  const files: { file: string; type: string; name: string }[] = [];
  if (input.frontImage) files.push({ file: stripDataUri(input.frontImage), type: "image/jpeg", name: "ID_VA_FRONT" });
  if (input.backImage) files.push({ file: stripDataUri(input.backImage), type: "image/jpeg", name: "ID_VA_BACK" });

  const url = joinUrl(execution.environment.baseUrl, config.checkEndpoint);
  const response = await fadApiAdapter.fetchWithRetry(execution.environment, url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ webhookNotification: false, files }),
  });
  const json = (await fadApiAdapter.safeJson(response)) as FadServiceResponse<{
    risk?: string;
    key?: string;
    result?: boolean;
  }>;
  if (!response.ok || json?.success === false || !json?.data) {
    throw AppError.upstream(json?.error ?? "El servicio CHECK (NAAT-CHECK) devolvió un error", {
      status: response.status,
    });
  }

  const checkData = json.data;
  const attempts = state.checkAttempts + 1;
  const accepted =
    typeof checkData.result === "boolean"
      ? checkData.result === true
      : (checkData.risk ?? "").toUpperCase() === config.checkAcceptedRisk.toUpperCase();
  const exhausted = !accepted && attempts >= config.checkMaxAttempts;

  const newState: WebSdkState = {
    ...state,
    checkAttempts: attempts,
    acuant: input,
    check: { risk: checkData.risk ?? "UNKNOWN", key: checkData.key ?? "", result: checkData.result },
  };

  await prisma.validationExecution.update({
    where: { id: executionId },
    data: {
      webSdkState: toJsonField(newState),
      normalizedStatus: exhausted ? "FAILED" : execution.normalizedStatus,
      result: exhausted ? "REJECTED" : null,
    },
  });

  return {
    accepted,
    risk: checkData.risk ?? "UNKNOWN",
    key: checkData.key ?? "",
    attemptsUsed: attempts,
    attemptsMax: config.checkMaxAttempts,
    exhausted,
  };
}

/** Paso 3: recibe el resultado de `startFacetec()` y lo guarda para el paso de comparación. */
export async function submitFacetecResult(executionId: string, input: WebSdkFacetecResultInput): Promise<void> {
  const execution = await getExecutionRowOrThrow(executionId);
  if (!input.selfie) throw AppError.badRequest("Facetec no devolvió una selfie utilizable.");
  const state = fromJsonField<WebSdkState>(execution.webSdkState, emptyState());
  const newState: WebSdkState = { ...state, facetec: input };
  await prisma.validationExecution.update({
    where: { id: executionId },
    data: { webSdkState: toJsonField(newState) },
  });
}

function pushImageEntry(entries: TarEntry[], name: string, dataUri: string | undefined): void {
  if (!dataUri) return;
  entries.push({ name, content: dataUriToBuffer(dataUri) });
}

/** Paso 4: compareFacesPassive + getValidationKeys + empaquetado/cifrado + saveValidationData.
 * Todo orquestado por el backend con el access_token del ambiente — nunca se cifra ni se envían
 * datos biométricos desde el navegador (ver websdk-crypto.ts). */
export async function completeWebSdkExecution(executionId: string): Promise<{ executionId: string }> {
  const execution = await getExecutionRowOrThrow(executionId);
  const config = await getWebSdkConfig(execution.environmentId);
  if (!config) throw AppError.badRequest("Este ambiente no tiene configuración Web SDK.");
  const state = fromJsonField<WebSdkState>(execution.webSdkState, emptyState());

  if (!state.acuant?.idPhoto) throw AppError.badRequest("Falta el idPhoto de la captura de documento (Acuant).");
  if (!state.facetec?.selfie) throw AppError.badRequest("Falta la selfie de la prueba de vida (Facetec).");
  if (!state.check) throw AppError.badRequest("Falta el resultado de NAAT-CHECK.");

  const accessToken = await fadApiAdapter.getAccessToken(execution.environment);

  // 1) compareFacesPassive (multipart: face1 = idPhoto, face2 = selfie)
  const form = new FormData();
  form.append("face1", new Blob([dataUriToBuffer(state.acuant.idPhoto)], { type: "image/jpeg" }), "face1.jpg");
  form.append("face2", new Blob([dataUriToBuffer(state.facetec.selfie)], { type: "image/jpeg" }), "face2.jpg");
  const compareUrl = joinUrl(execution.environment.baseUrl, config.compareFacesEndpoint);
  const compareResponse = await fadApiAdapter.fetchWithRetry(execution.environment, compareUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const compareJson = (await fadApiAdapter.safeJson(compareResponse)) as FadServiceResponse<{
    confidence: number;
    qualityFace1: number;
    qualityFace2: number;
  }>;
  if (!compareResponse.ok || compareJson?.success === false || !compareJson?.data) {
    throw AppError.upstream(compareJson?.error ?? "compareFacesPassive devolvió un error", {
      status: compareResponse.status,
    });
  }
  const compare = compareJson.data;
  if (compare.confidence < config.faceMatchMinConfidence) {
    await prisma.validationExecution.update({
      where: { id: executionId },
      data: { normalizedStatus: "FAILED", result: "REJECTED" },
    });
    throw AppError.badRequest(
      `El match facial no alcanzó el umbral configurado (confianza ${compare.confidence.toFixed(2)}%, mínimo ${config.faceMatchMinConfidence}%).`,
    );
  }

  // 2) getValidationKeys
  const keysUrl = joinUrl(execution.environment.baseUrl, config.getValidationKeysEndpoint);
  const keysResponse = await fadApiAdapter.fetchWithRetry(execution.environment, keysUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const keysJson = (await fadApiAdapter.safeJson(keysResponse)) as FadServiceResponse<{
    key: string;
    vector: string;
    validationId: string;
  }>;
  if (!keysResponse.ok || keysJson?.success === false || !keysJson?.data) {
    throw AppError.upstream(keysJson?.error ?? "getValidationKeys devolvió un error", { status: keysResponse.status });
  }
  const keys = keysJson.data;

  // 3) construir .TAR y cifrar a .FAD
  const startedAt = (execution.startedAt ?? execution.createdAt).toISOString();
  const completedAt = new Date().toISOString();
  const requestPayload = fromJsonField<{ client: { name: string; mail: string; phone: string } }>(
    execution.requestPayload,
    { client: { name: "Cliente", mail: "cliente@ejemplo.com", phone: "" } },
  );

  const metadata = buildMetadataJson({
    validationId: keys.validationId,
    processName: execution.processName,
    environmentName: execution.environment.name,
    templateName: execution.template?.name ?? null,
    client: requestPayload.client,
    acuant: state.acuant,
    facetec: state.facetec,
    check: state.check,
    compare,
    saveResult: {},
    startedAt,
    completedAt,
  });

  const entries: TarEntry[] = [{ name: "data.json", content: Buffer.from(JSON.stringify(metadata), "utf8") }];
  pushImageEntry(entries, "ineAnverso.png", state.acuant.frontImage);
  pushImageEntry(entries, "ineReverso.png", state.acuant.backImage);
  pushImageEntry(entries, "foto.png", state.acuant.idPhoto);
  pushImageEntry(entries, "selfie.png", state.facetec.selfie);
  if (state.facetec.auditTrail?.[0]) pushImageEntry(entries, "auditTrailImage.png", state.facetec.auditTrail[0]);
  if (state.facetec.lowQualityAuditTrail?.[0]) {
    pushImageEntry(entries, "lowQualityAuditTrailImage.png", state.facetec.lowQualityAuditTrail[0]);
  }
  if (state.facetec.faceScan) {
    entries.push({ name: "facescan", content: Buffer.from(state.facetec.faceScan, "utf8") });
  }

  const tar = buildTar(entries);
  const { fadBuffer, checksum } = buildFadFile(tar, keys.key, keys.vector);

  // 4) saveValidationData (binario, application/octet-stream, header `checksum`)
  const saveUrl = `${joinUrl(execution.environment.baseUrl, config.saveValidationDataEndpoint)}/${encodeURIComponent(keys.validationId)}`;
  const saveResponse = await fadApiAdapter.fetchWithRetry(execution.environment, saveUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, checksum, "Content-Type": "application/octet-stream" },
    body: fadBuffer,
  });
  const saveJson = (await fadApiAdapter.safeJson(saveResponse)) as FadServiceResponse<Record<string, unknown>>;
  if (!saveResponse.ok || saveJson?.success === false) {
    throw AppError.upstream(saveJson?.error ?? "saveValidationData devolvió un error", { status: saveResponse.status });
  }
  const saveResult = saveJson?.data ?? {};

  // 5) normalizar y persistir (misma forma canónica que las ejecuciones API-by-steps)
  const detail = buildWebSdkNormalizedDetail({
    validationId: keys.validationId,
    processName: execution.processName,
    environmentName: execution.environment.name,
    templateName: execution.template?.name ?? null,
    client: requestPayload.client,
    acuant: state.acuant,
    facetec: state.facetec,
    check: state.check,
    compare,
    saveResult,
    startedAt,
    completedAt,
  });

  await prisma.validationExecution.update({
    where: { id: executionId },
    data: {
      validationId: keys.validationId,
      normalizedResponse: toJsonField(detail),
      rawStatus: detail.rawStatus,
      normalizedStatus: detail.status,
      result: detail.result,
      // `keys.key`/`keys.vector` vienen OFUSCADOS de getValidationKeys (ver websdk-crypto.ts);
      // se guarda la versión des-ofuscada (la real, usable) para que "revelar secreto" en el
      // detalle de la ejecución muestre la key/vector reales, no el valor ofuscado.
      keyEncrypted: credentialEncryptionService.encrypt(deobfuscateFadKey(keys.key)),
      vectorEncrypted: credentialEncryptionService.encrypt(deobfuscateFadKey(keys.vector)),
      completedAt: new Date(completedAt),
      lastSyncedAt: new Date(),
      webSdkState: null,
    },
  });

  return { executionId };
}
