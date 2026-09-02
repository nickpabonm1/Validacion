import type { ApiEnvironment } from "@prisma/client";
import type { TestConnectionResultDto } from "@fad-console/shared-types";
import {
  FadTokenResponseSchema,
  CreateValidationResponseSchema,
  SaveValidationStepResponseSchema,
  GetValidationStepResponseSchema,
  GetValidationDataResponseSchema,
  type CreateValidationResponse,
  type SaveValidationStepResponse,
  type GetValidationStepResponse,
  type GetValidationDataResponse,
} from "@fad-console/validation-schemas";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { sha256Hex } from "../../lib/hash";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";
import { getCachedToken, setCachedToken, clearCachedToken } from "./token-cache";
import { joinUrl, withValidationId } from "./url";

interface DecryptedCredentials {
  basicAuthUsername: string | null;
  basicAuthPassword: string | null;
  apiUsername: string | null;
  apiPassword: string | null;
}

/**
 * El PDF documenta `getValidationStep` como envuelto en `{success, error, code, data}` (igual
 * que `getValidationData`), pero el método real verificado para UATHA es GET (no POST) y su
 * respuesta real — confirmada con una respuesta real de FAD, no documentada en el PDF ni en la
 * colección Postman — NO trae esa envoltura:
 *   - Éxito: el objeto `data` documentado ({processName, validation, client, steps, ...}) viene
 *     directamente en la raíz, sin `success`/`error`/`code`.
 *   - Error: `{code: string, message: string}` (p. ej. `{"code":"InvalidInputParameter",
 *     "message":"Unable find the validation"}`) — un `code` de texto, no el `code: number` que
 *     documenta el PDF para el caso envuelto.
 * Se normaliza aquí a la forma envuelta que ya espera el resto de la app (y que si algún
 * ambiente configura `getValidationStepHttpMethod: POST` sí podría devolver tal cual, según el
 * PDF) — nunca se fabrica un campo que FAD no haya devuelto, solo se reacomoda lo ya recibido.
 */
function normalizeGetValidationStepBody(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const record = json as Record<string, unknown>;
  if ("success" in record) return json; // ya viene envuelto: se deja intacto
  if (typeof record.code === "string" && typeof record.message === "string") {
    return { success: false, error: record.message, code: null, data: null };
  }
  return { success: true, error: null, code: null, data: record };
}

function decryptCredentials(environment: ApiEnvironment): DecryptedCredentials {
  return {
    basicAuthUsername: credentialEncryptionService.decryptOrNull(environment.basicAuthUsernameEnc),
    basicAuthPassword: credentialEncryptionService.decryptOrNull(environment.basicAuthPasswordEnc),
    apiUsername: credentialEncryptionService.decryptOrNull(environment.apiUsernameEnc),
    apiPassword: credentialEncryptionService.decryptOrNull(environment.apiPasswordEnc),
  };
}

/**
 * FadApiAdapter — único punto de contacto HTTP con la API FAD Biometrics By Steps. Ningún otro
 * módulo debe construir URLs ni llamar `fetch` contra FAD directamente (ver
 * docs/architecture.md §2). Maneja: autenticación OAuth con cache/renovación en memoria,
 * creación de validación, guardado de paso (payload ya cifrado por el llamador), consulta de
 * pasos (método configurable) y consulta detallada.
 */
class FadApiAdapter {
  /** Público: reutilizado por el módulo `websdk` (CHECK, compareFacesPassive,
   * getValidationKeys, saveValidationData) para respetar el mismo timeout/reintentos del
   * ambiente sin duplicar la lógica de red. */
  async fetchWithRetry(
    environment: ApiEnvironment,
    url: string,
    init: RequestInit,
    attempt = 0,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), environment.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.status >= 500 && attempt < environment.maxRetries) {
        await this.delay(250 * (attempt + 1));
        return this.fetchWithRetry(environment, url, init, attempt + 1);
      }
      return response;
    } catch (error) {
      if (attempt < environment.maxRetries) {
        await this.delay(250 * (attempt + 1));
        return this.fetchWithRetry(environment, url, init, attempt + 1);
      }
      logger.error("Fallo de red contactando FAD", { url, attempt, error: (error as Error).message });
      throw AppError.upstream("No fue posible conectar con el servicio FAD (timeout o red)", { url });
    } finally {
      clearTimeout(timeout);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async authenticate(environment: ApiEnvironment): Promise<{ accessToken: string; tokenType: string; expiresIn: number }> {
    const creds = decryptCredentials(environment);
    if (!creds.basicAuthUsername || !creds.basicAuthPassword || !creds.apiUsername || !creds.apiPassword) {
      throw AppError.badRequest(
        "El ambiente no tiene credenciales completas. Configure Basic Auth y usuario/contraseña de API en Configuración > Conexiones API.",
      );
    }

    const password = environment.passwordIsPreHashed ? creds.apiPassword : sha256Hex(creds.apiPassword);
    const basicAuth = Buffer.from(`${creds.basicAuthUsername}:${creds.basicAuthPassword}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: environment.grantType,
      username: creds.apiUsername,
      password,
    });

    const url = joinUrl(environment.baseUrl, environment.authTokenEndpoint);
    const response = await this.fetchWithRetry(environment, url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const json = await this.safeJson(response);
    if (!response.ok) {
      const message = this.extractAuthErrorMessage(json);
      throw AppError.upstream(`No fue posible autenticar contra FAD: ${message}`, { status: response.status });
    }

    const parsed = FadTokenResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw AppError.upstream("La respuesta de autenticación de FAD no tiene el formato esperado");
    }

    setCachedToken(environment.id, parsed.data.access_token, parsed.data.token_type, parsed.data.expires_in);
    return {
      accessToken: parsed.data.access_token,
      tokenType: parsed.data.token_type,
      expiresIn: parsed.data.expires_in,
    };
  }

  private extractAuthErrorMessage(json: unknown): string {
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

  /** Público: reutilizado por el módulo `websdk`. */
  async safeJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { rawText: text.slice(0, 500) };
    }
  }

  /** Público: reutilizado por el módulo `websdk` para obtener un access_token (con cache y
   * renovación) sin duplicar la lógica de autenticación OAuth. */
  async getAccessToken(environment: ApiEnvironment): Promise<string> {
    const cached = getCachedToken(environment.id, environment.tokenRefreshMarginSeconds);
    if (cached) return cached.accessToken;
    const fresh = await this.authenticate(environment);
    return fresh.accessToken;
  }

  async testConnection(environment: ApiEnvironment): Promise<TestConnectionResultDto> {
    clearCachedToken(environment.id);
    try {
      const result = await this.authenticate(environment);
      return {
        success: true,
        message: "La autenticación fue exitosa.",
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
      };
    } catch (error) {
      logger.warn("Prueba de conexión FAD fallida", { environmentId: environment.id, error: (error as Error).message });
      return {
        success: false,
        message: "No fue posible autenticar la conexión.",
        code: "AUTHENTICATION_FAILED",
      };
    }
  }

  async createValidation(
    environment: ApiEnvironment,
    requestBody: unknown,
  ): Promise<{ status: number; data: CreateValidationResponse }> {
    const accessToken = await this.getAccessToken(environment);
    const url = joinUrl(environment.baseUrl, environment.createValidationEndpoint);
    const response = await this.fetchWithRetry(environment, url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const json = await this.safeJson(response);
    const parsed = CreateValidationResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw AppError.upstream("La respuesta de creación de validación de FAD no tiene el formato esperado", {
        status: response.status,
      });
    }
    return { status: response.status, data: parsed.data };
  }

  /** El body es el payload YA cifrado (AES/CBC/PKCS5Padding) provisto por el llamador; este
   * adaptador nunca cifra ni genera datos biométricos, solo reenvía. */
  async saveValidationStep(
    environment: ApiEnvironment,
    validationId: string,
    encryptedPayload: string,
  ): Promise<{ status: number; data: SaveValidationStepResponse }> {
    const accessToken = await this.getAccessToken(environment);
    const url = joinUrl(environment.baseUrl, withValidationId(environment.saveValidationStepEndpoint, validationId));
    const response = await this.fetchWithRetry(environment, url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(encryptedPayload),
    });
    const json = await this.safeJson(response);
    const parsed = SaveValidationStepResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw AppError.upstream("La respuesta de guardado de paso de FAD no tiene el formato esperado", {
        status: response.status,
      });
    }
    return { status: response.status, data: parsed.data };
  }

  async getValidationStep(
    environment: ApiEnvironment,
    validationId: string,
  ): Promise<{ status: number; data: GetValidationStepResponse }> {
    const accessToken = await this.getAccessToken(environment);
    const url = joinUrl(environment.baseUrl, withValidationId(environment.getValidationStepEndpoint, validationId));
    // `Content-Type` solo tiene sentido cuando hay body (POST); en GET (el método real por
    // defecto para UATHA, comprobado en la colección Postman) nunca se envía cuerpo, así que
    // declarar un content-type ahí es semánticamente incorrecto y en algunos gateways/WAF puede
    // provocar que la petición se rechace o se responda con una página de error en vez de JSON.
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (environment.getValidationStepHttpMethod === "POST") headers["Content-Type"] = "application/json";
    const response = await this.fetchWithRetry(environment, url, {
      method: environment.getValidationStepHttpMethod,
      headers,
    });
    const json = await this.safeJson(response);
    const parsed = GetValidationStepResponseSchema.safeParse(normalizeGetValidationStepBody(json));
    if (!parsed.success) {
      logger.warn("getValidationStep devolvió un cuerpo que no cumple el contrato esperado", {
        environmentId: environment.id,
        url,
        method: environment.getValidationStepHttpMethod,
        status: response.status,
        zodIssues: parsed.error.issues,
        body: JSON.stringify(json).slice(0, 2000),
      });
      throw AppError.upstream("La respuesta de consulta de pasos de FAD no tiene el formato esperado", {
        status: response.status,
      });
    }
    return { status: response.status, data: parsed.data };
  }

  async getValidationData(
    environment: ApiEnvironment,
    validationId: string,
  ): Promise<{ status: number; data: GetValidationDataResponse }> {
    const accessToken = await this.getAccessToken(environment);
    const url = joinUrl(environment.baseUrl, withValidationId(environment.getValidationDataEndpoint, validationId));
    const response = await this.fetchWithRetry(environment, url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });
    const json = await this.safeJson(response);
    const parsed = GetValidationDataResponseSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn("getValidationData devolvió un cuerpo que no cumple el contrato esperado", {
        environmentId: environment.id,
        url,
        status: response.status,
        zodIssues: parsed.error.issues,
        body: JSON.stringify(json).slice(0, 2000),
      });
      throw AppError.upstream("La respuesta de información detallada de FAD no tiene el formato esperado", {
        status: response.status,
      });
    }
    if (parsed.data.success === false) {
      logger.warn("getValidationData respondió success:false", {
        environmentId: environment.id,
        url,
        validationId,
        status: response.status,
        error: parsed.data.error,
        code: parsed.data.code,
      });
    }
    return { status: response.status, data: parsed.data };
  }
}

export const fadApiAdapter = new FadApiAdapter();
