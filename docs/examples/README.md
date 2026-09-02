# Ejemplos

## `websdk-config.example.json` / `websdk-config-regula.example.json`

Plantillas para el botón **«Importar configuración (JSON)»** de Ambientes → pestaña **Web SDK**
(ver `apps/frontend/src/lib/websdk-config-import.ts`). Tienen el mismo shape que
`WebSdkConfigInput` (ver `packages/validation-schemas/src/admin/websdk-config.schema.ts`):
credenciales de Acuant o Regula, Facetec, endpoints y parametrización del SDK. Use el primero para
un ambiente con `documentCaptureEngine: ACUANT` y el segundo para uno con `REGULA` (ver
`docs/websdk-integration.md` "Regula" para las diferencias entre ambos motores).

Solo se aplican al formulario los campos que el archivo trae explícitamente — el resto queda
intacto (mismo principio "vacío/ausente = no cambiar" que el resto de la consola).

Los valores `CAMBIAR_*` son placeholders ficticios: reemplácelos por sus credenciales reales
(Acuant: usuario/contraseña/subscription ID; Regula: licencia en Base64 y el `apiBasePath` interno
provisto por el equipo de soluciones) antes de importar. Los endpoints (`acuantAcasEndpoint`,
`facetecMiddleware.module`, etc.) son los valores públicos y no sensibles ya documentados como
default en el schema — no son secretos, describen la forma del contrato, no una credencial. Este
repositorio nunca incluye credenciales reales de ningún tercero (ver `docs/technical-analysis.md`
y `docs/websdk-integration.md`).
