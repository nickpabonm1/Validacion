# Análisis técnico — FAD Biometrics Configuration & Results Console

Este documento resume la revisión de la documentación fuente (`API FAD Web Biometrics By
Steps.pdf` v1.4, `Webhooks Service Definition (client).pdf` v1.3, y la colección Postman
`FAD-BIOMETRICS-ValidationSteps Autentic COL UATHA`) y las decisiones tomadas para construir
la consola. **Ningún valor de credencial real de la colección Postman o de los PDF fue copiado
al código, configuración, seeds o documentación.** Solo se documentan formatos, endpoints y
estructuras.

## 1. Contratos confirmados

### 1.1 Autenticación — `POST {baseUrl}/authorization-server/oauth/token`

| Aspecto | Documento PDF | Colección Postman (UATHA) | Decisión adoptada |
|---|---|---|---|
| Content-Type | `multipart/form-data` (texto) pero el ejemplo de headers dice `application/x-www-form-urlencoded` | `application/x-www-form-urlencoded` | **`application/x-www-form-urlencoded`** (comportamiento comprobado tiene prioridad) |
| Auth header | Basic Auth | Basic Auth (`Authorization: Basic <base64>`) | Basic Auth con usuario/contraseña configurables por ambiente |
| Body | `grant_type`, `username`, `password` | Igual | Igual. `grant_type` por defecto `password` pero configurable |
| Password | El PDF exige SHA-256 del password antes de enviarlo | El valor en Postman es opaco (podría ya estar hasheado) | Se agrega el flag `passwordIsPreHashed` por ambiente; si es `false` el adaptador aplica SHA-256 una sola vez, si es `true` se envía tal cual |
| Respuesta éxito | `access_token, token_type, refresh_token, expires_in, scope, jti` | No se ejecutó la colección (no hay credenciales reales) | Se modela el contrato documentado |
| Respuesta error | `error, error_description` con catálogo de mensajes OAuth estándar | — | Se normaliza a `FadAuthError` |

### 1.2 Crear validación — `POST {baseUrl}/biometrics-by-steps/validations`

Confirmado por PDF y por la colección Postman (`createValidation Autentic AF`). El **body de
ejemplo real de Postman** confirma la estructura completa usada como base del *Request
Builder* (sección 13 del brief), incluyendo `steps.formValidationId.input.forms[]` con
`classification` y `fields[]` (`id, inputType, label, placeholder, required, replaceValue,
value`), y `customization.theme[]` / `customization.header[]` con las variables CSS exactas
listadas en el brief. Respuesta de éxito: `{ success, error, code, data: { key, vector,
validationId } }`. **No se documenta ni se infiere ninguna URL de lanzamiento del proceso** —
por eso `launchUrlTemplate` es opcional y vacío por defecto (sección 14 / inconsistencia 6).

### 1.3 Guardar paso — `POST {baseUrl}/validation/saveValidationStep/{validationId}`

El body es el JSON cifrado con AES/CBC/PKCS5Padding generado por el SDK oficial de captura
biométrica (no incluido en este proyecto). La consola implementa este servicio como **módulo
técnico avanzado**: recibe un payload ya cifrado (string) y lo reenvía, sin simular datos
biométricos reales, dejando preparada la interfaz para conectar el SDK oficial más adelante.

### 1.4 Consultar estado por pasos — `getValidationStep/{validationId}`

| Fuente | Método |
|---|---|
| PDF | `POST` |
| Postman (UATHA) | `GET` |

**Inconsistencia confirmada.** Se resuelve haciendo el método HTTP configurable por ambiente
(`getValidationStepHttpMethod`), con **`GET` como valor por defecto para UATHA** (igual que la
colección, que es comportamiento comprobado).

### 1.5 Obtener información detallada — `POST validation/validations/getValidationData/{validationId}`

Confirmado por PDF (no ejecutado en la colección adjunta). Respuesta con gran cantidad de
campos opcionales/dinámicos (`client`, `face`, `deviceInfo`, `networkInfo`, `fingerprints`,
`pageDetail`, `latitude/longitude`, `files[]`, `extraInfo`, `validationProcessResult`, etc.).
El esquema Zod de este contrato usa `.passthrough()` para no descartar campos no documentados
y todos los campos salvo `success` son opcionales/nullable.

## 2. Estructuras JSON del SDK por paso (sección 3 del PDF)

Documentadas y modeladas como *fixtures* sanitizados en
`packages/validation-schemas/src/fixtures`: `location`, `privacyNotice`, `captureId` (variante
Acuant `providerId=2` y Regula `providerId=1`, confirmando que **el significado de los IDs de
proveedor no es fijo** — de ahí el catálogo editable de proveedores), `formValidationId`,
`idDetection`, `liveness`, `fingerprints` (1 a 10 huellas, formatos `wsq`/`jpeg`), `enrollFace`
y `authFace` (marcados como *avanzado/experimental* porque el endpoint de creación documentado
no confirma su aceptación).

## 3. Validaciones externas (sección 4 del PDF)

`accuant_validation`, `comparison_selfie_ine_validation`,
`validation_big_data_corp_decision_check/empresa/pessoa/pessoa_kyc`, `validation_serpro`,
`validation_unico`. Cada una tiene una forma de respuesta distinta y parcialmente solapada
(`validation_result`, `cpf`, `cnpj`, etc.). Se implementan como *renderers* extensibles por
`resultKey`; un resultado no reconocido cae a una vista JSON genérica en lugar de descartarse.

## 4. Webhooks (Webhooks Service Definition v1.3)

Endpoint del lado del cliente: `POST /webhook/receive` (en esta consola: `POST
/api/webhooks/fad`). Autenticación: usuario/contraseña definidos por el cliente (Basic Auth),
**opcional según el documento** ("en caso de que la URL expuesta no tenga autenticación no
genera ningún problema de seguridad" — no se sigue esa recomendación de baja seguridad; se
implementa Basic Auth configurable y recomendada). Envelope general:

```json
{ "id": "...", "idUser": "...", "event": "...", "creationDate": "DD/MM/YYYY HH:mm:ss",
  "data": {}, "retry": 0, "error": "", "idOriginal": null }
```

Eventos de biometría por pasos modelados con detalle (`CREATED_VALIDATION_STEP`,
`RESULT_VALIDATION_STEP`, `COMPLETED_VALIDATION_STEP`, `COMPLETED_VALIDATION`,
`VALIDATION_CHANGE_STATUS`). Eventos FAD/FEA de firma (`CREATE_OTP`, `CREATE_REQUISITION`,
`SIGNED_REQUISITION`, etc.) se **aceptan y persisten** (para no perder eventos) pero no tienen
UI dedicada en esta primera entrega — se muestran en el visor genérico de eventos.

`creationDate` documentado como `DD/MM/YYYY HH:mm:ss`; la respuesta de `getValidationStep`
usa `startDate`/`endDate` con formato `YYYY-MM-DD HH:mm`; no hay garantía de formato único →
`parseFlexibleDate` soporta ambos + ISO + epoch numérico, preservando siempre `rawDate`.

## 5. Inconsistencias documentadas y su resolución (sección 30 del brief)

1. **Content-Type de autenticación**: se usa `application/x-www-form-urlencoded` (comprobado
   en Postman), encapsulado en el adaptador para poder cambiarlo si un ambiente lo requiere.
2. **Password SHA-256 vs prehash**: `passwordIsPreHashed` por ambiente; el adaptador nunca
   aplica el hash dos veces.
3. **Método de `getValidationStep`**: configurable por ambiente, `GET` por defecto en UATHA.
4. **IDs de proveedor** (`captureId.features.provider`): catálogo editable
   (`ProviderCatalogEntry`), sin relación fija proveedor↔ID en código.
5. **Estados en español/inglés** (`EN_PROCESO`, `TERMINADO`, `PENDING`, `COMPLETED`,
   `FINISHED`, `Aprobado`/`Approved`...): se normalizan a un enum interno
   (`CREATED|IN_PROGRESS|COMPLETED|FAILED|EXPIRED|CANCELLED|UNKNOWN`) preservando siempre
   `rawStatus`.
6. **URL de ejecución del proceso**: no documentada en la respuesta de creación → nunca se
   infiere; `launchUrlTemplate` es opcional, vacío por defecto, con placeholders
   `{validationId} {key} {vector}`.
7. **Campos dinámicos** en `getValidationData`/`getValidationStep`: todos los esquemas Zod de
   respuesta usan modo *passthrough* y solo `success` es estrictamente requerido.

## 6. Decisión de stack (resuelve una contradicción del propio encargo)

El encargo especifica dos stacks distintos en secciones diferentes: Next.js + PostgreSQL +
Docker obligatorio (sección 4) y, más adelante, una sección explícita **"HERRAMIENTA Y
TECNOLOGÍA FÁCIL DE COMPILAR"** que pide React + Vite + Express + Prisma + **SQLite por
defecto**, monorepo con npm workspaces, Docker opcional. Se adopta la **segunda** instrucción
por ser más específica, más reciente en el documento y explícitamente orientada a que el
proyecto compile e instale sin dependencias externas — objetivo declarado como prioritario
("Prioriza una solución fácil de instalar y compilar sobre una arquitectura innecesariamente
compleja"). Se preserva el espíritu de la primera sección (TypeScript estricto, Zod, RHF,
TanStack Query, dnd-kit, Prisma, separación por capas, RBAC, auditoría) dentro del stack
Vite/Express. Ver `docs/architecture.md`.

## 7. Estructura del proyecto propuesta

```
/
├── apps/
│   ├── frontend/         # Vite + React + TS + Tailwind
│   └── backend/          # Node + Express + TS + Prisma
├── packages/
│   ├── shared-types/     # Tipos TS compartidos (contratos FAD, enums, DTOs)
│   ├── validation-schemas/ # Esquemas Zod + fixtures sanitizados
│   └── ui/                # Componentes UI compartidos (design system mínimo)
├── prisma/                # schema.prisma, migrations, seed
├── docs/
└── package.json           # npm workspaces
```

Ver `docs/architecture.md` para el detalle de módulos y `docs/api-contracts.md` para el detalle
campo por campo de cada servicio.
