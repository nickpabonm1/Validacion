import { MessagingConfigForm } from "../components/domain/MessagingConfigForm";
import { PageHeader } from "../components/ui/misc";

/** Correo (SMTP) y WhatsApp (Cloud API) usados para enviar el enlace de captura compartido — ver
 * «Nueva ejecución (Web SDK)» → «Enviar al cliente», y el botón «Enviar por correo» del enlace de
 * validación del flujo por pasos. Antes vivía embebido dentro de "Configuración"; se separó a su
 * propia pestaña porque es una configuración de negocio distinta (proveedor de mensajería) de los
 * parámetros generales del sistema. */
export function MessagingPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Mensajería" description="Servidor de correo (SMTP) y WhatsApp (Cloud API) para enviar el enlace de validación." />
      <MessagingConfigForm />
    </div>
  );
}
