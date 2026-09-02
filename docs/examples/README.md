# Ejemplos

## `websdk-config.example.json`

Plantilla para el botón **«Importar configuración (JSON)»** de Ambientes → pestaña **Web SDK**
(ver `apps/frontend/src/lib/websdk-config-import.ts`). Tiene el mismo shape que
`WebSdkConfigInput` (ver `packages/validation-schemas/src/admin/websdk-config.schema.ts`):
credenciales de Acuant/Facetec, endpoints y parametrización del SDK.

Solo se aplican al formulario los campos que el archivo trae explícitamente — el resto queda
intacto (mismo principio "vacío/ausente = no cambiar" que el resto de la consola).

Los valores `CAMBIAR_*` son placeholders ficticios: reemplácelos por sus credenciales reales de
Acuant (usuario/contraseña/subscription ID) antes de importar. Los endpoints (`acuantAcasEndpoint`,
`facetecMiddleware.module`, etc.) son los valores públicos y no sensibles ya documentados como
default en el schema — no son secretos, describen la forma del contrato, no una credencial. Este
repositorio nunca incluye credenciales reales de ningún tercero (ver `docs/technical-analysis.md`
y `docs/websdk-integration.md`).
