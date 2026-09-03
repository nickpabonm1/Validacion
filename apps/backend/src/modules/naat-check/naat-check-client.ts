import {
  NaatCheckComposeMessageResponseSchema,
  NaatCheckTokenResponseSchema,
  type NaatCheckComposeMessageResponse,
} from "@fad-console/validation-schemas";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { sha256Hex } from "../../lib/hash";
import { getCachedToken, setCachedToken, clearCachedToken } from "../fad-adapter/token-cache";

const NAAT_CHECK_TOKEN_ENDPOINT = "/authorization-server/oauth/token";
const NAAT_CHECK_COMPOSE_ENDPOINT = "/naat-check-api/idholo/multiple";
const REQUEST_TIMEOUT_MS = 20000;
/** El token dura 12h según el PDF (`expires_in`); igual que FadApiAdapter, se renueva un poco
 * antes de expirar en vez de esperar a que el servidor lo rechace. */
const TOKEN_REFRESH_MARGIN_SECONDS = 60;

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Cache key con prefijo propio — comparte el mismo mapa en memoria que FadApiAdapter
 * (`fad-adapter/token-cache.ts`) pero nunca colisiona con un token de FAD porque ningún
 * `environmentId` real empieza con este prefijo. */
function cacheKey(environmentId: string): string {
  return `naat-check:${environmentId}`;
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text.slice(0, 500) };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    logger.error("Fallo de red contactando NAAT-CHECK", { url, error: error instanceof Error ? error.message : error });
    throw AppError.upstream("No fue posible conectar con el servicio NAAT-CHECK (timeout o red)", { url });
  } finally {
    clearTimeout(timeout);
  }
}

function extractAuthErrorMessage(json: unknown): string {
  if (json && typeof json === "object" && "error_description" in json) {
    const description = (json as Record<string, unknown>).error_description;
    if (typeof description === "string") return description;
  }
  if (json && typeof json === "object" && "error" in json) {
    const error = (json as Record<string, unknown>).error;
    if (typeof error === "string") return error;
  }
  return "credenciales inválidas o servicio no disponible";
}

interface NaatCheckAuthParams {
  environmentId: string;
  baseUrl: string;
  username: string;
  password: string;
}

async function authenticate(params: NaatCheckAuthParams): Promise<{ accessToken: string; tokenType: string; expiresIn: number }> {
  const url = joinUrl(params.baseUrl, NAAT_CHECK_TOKEN_ENDPOINT);
  // El PDF (sección 2.1) exige el password ya convertido a hash SHA-256 en el cuerpo — nunca en
  // texto plano, ni siquiera sobre HTTPS.
  const body = new URLSearchParams({
    grant_type: "password",
    username: params.username,
    password: sha256Hex(params.password),
  });

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await safeJson(response);
  if (!response.ok) {
    throw AppError.upstream(`No fue posible autenticar contra NAAT-CHECK: ${extractAuthErrorMessage(json)}`, {
      status: response.status,
    });
  }

  const parsed = NaatCheckTokenResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw AppError.upstream("La respuesta de autenticación de NAAT-CHECK no tiene el formato esperado");
  }

  setCachedToken(cacheKey(params.environmentId), parsed.data.access_token, parsed.data.token_type, parsed.data.expires_in);
  return { accessToken: parsed.data.access_token, tokenType: parsed.data.token_type, expiresIn: parsed.data.expires_in };
}

async function getAccessToken(params: NaatCheckAuthParams): Promise<string> {
  const cached = getCachedToken(cacheKey(params.environmentId), TOKEN_REFRESH_MARGIN_SECONDS);
  if (cached) return cached.accessToken;
  const fresh = await authenticate(params);
  return fresh.accessToken;
}

/** Prueba de conexión real: fuerza una autenticación nueva (ignora cualquier token en cache) y
 * reporta éxito/fallo genuino — nunca fabrica un resultado. */
export async function testNaatCheckConnection(params: NaatCheckAuthParams): Promise<{ success: boolean; message: string }> {
  clearCachedToken(cacheKey(params.environmentId));
  try {
    await authenticate(params);
    return { success: true, message: "La autenticación con NAAT-CHECK fue exitosa." };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "No fue posible conectar." };
  }
}

export interface NaatCheckFile {
  file: string;
  type: string;
  name: string;
}

/** Envía las imágenes a NAAT-CHECK en modo síncrono (`webhookNotification: false`) — la respuesta
 * ya trae `data.risk`/`data.key`/`data.result` sin depender de un webhook posterior (ver el
 * comentario de `NaatCheckComposeMessageRequestSchema`). */
export async function requestNaatCheckRecheck(
  params: NaatCheckAuthParams,
  files: NaatCheckFile[],
): Promise<NaatCheckComposeMessageResponse["data"]> {
  if (files.length === 0) {
    throw AppError.badRequest("Esta ejecución no tiene imágenes de documento capturadas para enviar a NAAT-CHECK.");
  }

  const accessToken = await getAccessToken(params);
  const url = joinUrl(params.baseUrl, NAAT_CHECK_COMPOSE_ENDPOINT);
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ webhookNotification: false, files }),
  });

  const json = await safeJson(response);
  const parsed = NaatCheckComposeMessageResponseSchema.safeParse(json);
  if (!parsed.success) {
    logger.warn("NAAT-CHECK devolvió un cuerpo que no cumple el contrato esperado", {
      status: response.status,
      zodIssues: parsed.error.issues,
      body: JSON.stringify(json).slice(0, 2000),
    });
    throw AppError.upstream("La respuesta de NAAT-CHECK no tiene el formato esperado", { status: response.status });
  }

  if (!response.ok || parsed.data.success === false || !parsed.data.data) {
    throw AppError.upstream(parsed.data.error ?? "NAAT-CHECK devolvió un error", {
      status: response.status,
      code: parsed.data.code,
    });
  }

  return parsed.data.data;
}
