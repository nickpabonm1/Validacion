# Decisiones de seguridad

## Credenciales

- Única variable sensible requerida para instalar: `APP_ENCRYPTION_KEY` (32 bytes en base64,
  generada con `npm run generate:encryption-key`). No vive en la base de datos.
- Todo secreto de `ApiEnvironment` (`basicAuthPassword`, `apiPassword`, `webhookPassword`) se
  cifra con **AES-256-GCM** vía `CredentialEncryptionService` antes de tocar disco. El valor
  almacenado incluye IV, auth tag y versión de cifrado para permitir rotación futura sin
  romper datos existentes.
- El API nunca devuelve un secreto guardado al frontend: los endpoints de `ApiEnvironment`
  responden `{"...Configured": boolean}` en vez del valor. Un campo vacío en edición significa
  "conservar el existente"; existe una acción explícita de "eliminar credencial".
- El token OAuth de FAD (`access_token`) se cachea **solo en memoria del proceso backend**, por
  ambiente, con renovación anticipada (`tokenRefreshMarginSeconds`). Nunca se persiste ni se
  envía al navegador.
- `key` y `vector` devueltos por `createValidation` se guardan cifrados y se muestran
  enmascarados por defecto en la UI; revelarlos requiere una acción explícita de un usuario
  autenticado con permiso. Se registra en auditoría *que* fueron revelados, nunca su valor.
- Redacción de logs: un serializador central (`redact.ts`) sustituye por `"[REDACTED]"`
  cualquier campo cuyo nombre matchee `password|secret|token|authorization|key|vector` antes
  de loggear objetos de request/response del adaptador FAD.

## Autenticación y autorización de la consola

- Sesión de usuario vía JWT en cookie `httpOnly`, `sameSite=lax`, `secure` en producción.
  Contraseñas con `bcrypt` (12 rounds).
- RBAC de 3 roles: `ADMIN` (gestiona ambientes/secretos/plantillas/vistas/usuarios, ve
  auditoría), `OPERATOR` (ejecuta validaciones, consulta resultados, no toca secretos),
  `AUDITOR` (solo lectura, ve auditoría, información sensible enmascarada siempre).
- Middleware `requireRole([...])` en cada ruta sensible del backend (no solo ocultamiento en
  UI).

## Webhooks entrantes

- `POST /api/webhooks/fad` valida Basic Auth con comparación en **tiempo constante**
  (`crypto.timingSafeEqual`, longitudes igualadas antes de comparar para evitar leak por
  longitud).
- Idempotencia: hash único por `(externalEventId=id, idOriginal)`; un evento repetido no se
  reprocesa dos veces (se marca `processingStatus=DUPLICATE` y responde `200`).
- Se responde `2xx` inmediatamente tras persistir el payload crudo; el procesamiento
  (actualizar `ValidationExecution`/`ValidationStepExecution`, disparar auditoría) ocurre
  después, de forma desacoplada del ciclo de request/response.
- Eventos no reconocidos **no se rechazan**: se guardan con `eventType` tal cual para análisis
  posterior, sin romper el contrato con FAD.
- El payload crudo se guarda tal cual llega (para trazabilidad), pero **nunca se imprime en
  logs de aplicación** más allá de un resumen redactado.

## SSRF y URLs configurables

- `baseUrl` de cada ambiente y `launchUrlTemplate` se validan como URL `https` (excepto
  `localhost`/`127.0.0.1` en desarrollo) antes de guardarse.
- El *media proxy* que sirve archivos de FAD solo permite solicitar recursos cuyo host
  coincida con el `baseUrl` (o dominio de archivos) configurado del ambiente activo — nunca
  una URL arbitraria enviada por el cliente.

## Otras protecciones

- Cabeceras de seguridad (Helmet): CSP restrictiva, `X-Content-Type-Options`,
  `Referrer-Policy`, HSTS en producción.
- CORS restringido al origen del frontend configurado.
- Rate limiting en `/api/auth/login` y `/api/webhooks/fad`.
- Validación estricta de entrada con Zod en cada ruta (`safeParse`, 400 con detalle no
  sensible en caso de error).
- Ningún dato biométrico real se genera ni se simula; el módulo de "guardar paso" solo reenvía
  payloads ya cifrados que el llamador provee explícitamente.
- Los seeds de demostración no contienen nombres, correos, teléfonos, documentos ni
  `validationId` reales — son datos ficticios marcados `DEMO`.

## Limitaciones conocidas / riesgos pendientes

- No se implementa verificación de firma criptográfica de los webhooks (FAD no documenta un
  mecanismo de firma más allá de Basic Auth) — el Basic Auth + almacenamiento idempotente es la
  mitigación disponible con la información provista.
- El cifrado AES/CBC/PKCS5Padding del SDK biométrico no se implementa (requiere el SDK oficial
  de captura, fuera de alcance) — el endpoint de guardado de paso queda preparado como
  integración técnica, no simula datos.
- Rotación de `APP_ENCRYPTION_KEY` requiere descifrar y re-cifrar todos los secretos existentes
  (no automatizado en v1; el campo `encryptionVersion` deja la puerta abierta).
