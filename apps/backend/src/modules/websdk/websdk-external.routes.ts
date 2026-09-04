import { Router } from "express";
import rateLimit from "express-rate-limit";
import { WebSdkExternalValidationInputSchema } from "@fad-console/validation-schemas";
import { requireExternalApiKey } from "../environments/external-api-key.middleware";
import { logAudit } from "../audit/audit.service";
import { createShareLink, getExternalValidationStatus, toShareLinkDto } from "./websdk-share.service";

/**
 * API pública para que un SISTEMA EXTERNO (no un operador de esta consola, no el cliente final)
 * cree por su cuenta una "validación completa" que por detrás usa el Web SDK ya configurado en
 * el ambiente (Ambientes > Web SDK): crea el enlace de captura (mismo mecanismo que "Enviar al
 * cliente" en la consola) y lo devuelve para que el sistema externo se lo entregue a su usuario.
 * Ese usuario completa TODO el flujo por su cuenta en `/v/:token` (welcome → documento → prueba
 * de vida → guardado) — la ejecución nunca requiere que un operador vuelva a intervenir. Se
 * autentica con la clave de API del ambiente (`Authorization: Bearer <clave>`), nunca con la
 * cookie de sesión de la consola — ver `external-api-key.middleware.ts`. `GET /:id` (misma
 * clave) permite hacer polling del estado y, una vez `COMPLETED`, trae el resultado COMPLETO en
 * `detail` (OCR, validación de documento, alertas, clasificación, comparación facial — la misma
 * forma canónica `NormalizedValidationDetail` que ve un operador en el reporte de la consola,
 * ver `getExternalValidationStatus`), nunca solo un veredicto resumido.
 */
export const websdkExternalRouter = Router();

const externalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
websdkExternalRouter.use(externalApiLimiter, requireExternalApiKey);

websdkExternalRouter.post("/", async (req, res, next) => {
  try {
    const body = WebSdkExternalValidationInputSchema.parse(req.body);
    const environment = req.externalApiEnvironment!;
    const { link, environmentName } = await createShareLink({ ...body, environmentId: environment.id }, null);
    await logAudit(
      "CREATE",
      "WebSdkShareLink",
      link.id,
      { userId: null, ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null },
      { via: "externalApiKey", environmentId: environment.id },
    );
    res.status(201).json({ validation: toShareLinkDto(link, environmentName, true) });
  } catch (error) {
    next(error);
  }
});

websdkExternalRouter.get("/:id", async (req, res, next) => {
  try {
    const environment = req.externalApiEnvironment!;
    const status = await getExternalValidationStatus(req.params.id as string, environment.id);
    res.json({ validation: status });
  } catch (error) {
    next(error);
  }
});
