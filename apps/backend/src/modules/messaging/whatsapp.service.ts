import { AppError } from "../../lib/errors";
import { decryptMessagingCredentials, getMessagingConfig } from "./messaging-config.service";

export interface SendShareLinkWhatsappInput {
  to: string;
  processName: string;
  publicUrl: string;
}

interface WhatsAppApiErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

/** Envía el enlace de captura Web SDK por WhatsApp usando la Cloud API de Meta
 * (`POST /{phoneNumberId}/messages`, ver https://developers.facebook.com/docs/whatsapp/cloud-api).
 * Requiere una plantilla ya aprobada por Meta (`whatsappTemplateName`): fuera de una ventana de
 * conversación abierta, WhatsApp Business rechaza cualquier mensaje que no sea de plantilla —
 * esto no es una limitación de esta consola, es una regla de la API de Meta. Nunca fabrica una
 * confirmación de envío: se devuelve exactamente lo que Meta respondió, o se lanza el error real. */
export async function sendShareLinkWhatsapp(input: SendShareLinkWhatsappInput): Promise<{ messageId: string }> {
  const config = await getMessagingConfig();
  const creds = decryptMessagingCredentials(config);

  if (!config.whatsappPhoneNumberId || !creds.whatsappAccessToken || !config.whatsappTemplateName) {
    throw AppError.badRequest(
      "La mensajería por WhatsApp no está configurada. Ve a Configuración > Mensajería y completa el phone number ID, el token de acceso y la plantilla aprobada por Meta.",
    );
  }

  const url = `${config.whatsappApiBaseUrl}/${encodeURIComponent(config.whatsappPhoneNumberId)}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.whatsappAccessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: config.whatsappTemplateName,
        language: { code: config.whatsappTemplateLanguage },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: input.processName }, { type: "text", text: input.publicUrl }],
          },
        ],
      },
    }),
  });

  const json = (await response.json().catch(() => null)) as (WhatsAppApiErrorBody & { messages?: { id: string }[] }) | null;

  if (!response.ok || !json?.messages?.[0]?.id) {
    throw AppError.upstream(json?.error?.message ?? "La Cloud API de WhatsApp devolvió un error", {
      status: response.status,
    });
  }

  return { messageId: json.messages[0].id };
}
