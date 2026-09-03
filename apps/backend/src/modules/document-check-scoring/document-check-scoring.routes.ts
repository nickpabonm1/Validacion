import { Router } from "express";
import { DocumentCheckScoringConfigInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import {
  getDocumentCheckScoringConfig,
  toDocumentCheckScoringConfigDto,
  upsertDocumentCheckScoringConfig,
} from "./document-check-scoring.service";

export const documentCheckScoringRouter = Router();

documentCheckScoringRouter.use(requireAuth);

/** Cualquier rol autenticado puede leer la configuración: el reporte necesita puntuar
 * `documentChecks` para operadores/auditores, no solo para administradores. */
documentCheckScoringRouter.get("/", async (_req, res, next) => {
  try {
    const config = await getDocumentCheckScoringConfig();
    res.json({ documentCheckScoringConfig: toDocumentCheckScoringConfigDto(config) });
  } catch (error) {
    next(error);
  }
});

documentCheckScoringRouter.put("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = DocumentCheckScoringConfigInputSchema.parse(req.body);
    const config = await upsertDocumentCheckScoringConfig(input);
    await logAudit("UPDATE", "DocumentCheckScoringConfig", "singleton", auditContextFrom(req));
    res.json({ documentCheckScoringConfig: toDocumentCheckScoringConfigDto(config) });
  } catch (error) {
    next(error);
  }
});
