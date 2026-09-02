import { Router } from "express";
import { WebSdkShareLinkInputSchema, WebSdkShareSendInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { AppError } from "../../lib/errors";
import { sendShareLinkEmail } from "../messaging/email.service";
import { sendShareLinkWhatsapp } from "../messaging/whatsapp.service";
import { createShareLink, toShareLinkDto } from "./websdk-share.service";
import { prisma } from "../../lib/prisma";

export const websdkShareRouter = Router();

websdkShareRouter.use(requireAuth, requireRole("ADMIN", "OPERATOR", "LAUNCHER"));

/** Crea un enlace de captura Web SDK compartible. El `token`/`publicUrl` solo viajan en ESTA
 * respuesta (ver `toShareLinkDto`) — úsalos de inmediato para generar el QR o enviarlos. */
websdkShareRouter.post("/", async (req, res, next) => {
  try {
    const input = WebSdkShareLinkInputSchema.parse(req.body);
    const { link, environmentName } = await createShareLink(input, req.user!.sub);
    await logAudit("CREATE", "WebSdkShareLink", link.id, auditContextFrom(req), { environmentId: input.environmentId });
    res.status(201).json({ shareLink: toShareLinkDto(link, environmentName, true) });
  } catch (error) {
    next(error);
  }
});

/** Envía el enlace ya creado por correo o WhatsApp. Nunca reporta éxito si el proveedor no lo
 * confirmó — ver messaging/email.service.ts y messaging/whatsapp.service.ts. */
websdkShareRouter.post("/:id/send", async (req, res, next) => {
  try {
    const input = WebSdkShareSendInputSchema.parse(req.body);
    const link = await prisma.webSdkShareLink.findUnique({
      where: { id: req.params.id as string },
      include: { environment: true },
    });
    if (!link) throw AppError.notFound("Enlace no encontrado");
    if (link.expiresAt.getTime() < Date.now()) throw AppError.badRequest("Este enlace ya expiró.");

    const publicUrl = toShareLinkDto(link, link.environment.name, true).publicUrl!;
    const processName = link.processName ?? "Verificación de identidad";

    if (input.channel === "EMAIL") {
      const result = await sendShareLinkEmail({
        to: input.destination,
        processName,
        environmentName: link.environment.name,
        publicUrl,
      });
      await logAudit("SHARE_LINK_SENT", "WebSdkShareLink", link.id, auditContextFrom(req), { channel: "EMAIL" });
      res.json({ delivered: true, messageId: result.messageId });
      return;
    }

    const result = await sendShareLinkWhatsapp({ to: input.destination, processName, publicUrl });
    await logAudit("SHARE_LINK_SENT", "WebSdkShareLink", link.id, auditContextFrom(req), { channel: "WHATSAPP" });
    res.json({ delivered: true, messageId: result.messageId });
  } catch (error) {
    next(error);
  }
});
