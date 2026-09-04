import { NaatCheckTokenResponseSchema } from "@fad-console/validation-schemas";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { sha256Hex } from "../../lib/hash";

const NAAT_CHECK_TOKEN_ENDPOINT = "/authorization-server/oauth/token";
const REQUEST_TIMEOUT_MS = 20000;

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
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

  return { accessToken: parsed.data.access_token, tokenType: parsed.data.token_type, expiresIn: parsed.data.expires_in };
}

/** Prueba de conexión real: siempre autentica de nuevo y reporta éxito/fallo genuino — nunca
 * fabrica un resultado. */
export async function testNaatCheckConnection(params: NaatCheckAuthParams): Promise<{ success: boolean; message: string }> {
  try {
    await authenticate(params);
    return { success: true, message: "La autenticación con NAAT-CHECK fue exitosa." };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "No fue posible conectar." };
  }
}

