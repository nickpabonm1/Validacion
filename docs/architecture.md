# Arquitectura

## 1. Visión general

```
┌──────────────────────┐        ┌───────────────────────────────────────────┐        ┌─────────────────┐
│   Frontend (Vite)     │  HTTP  │              Backend (Express)             │  HTTP  │   FAD API        │
│  React + RHF + Zod    │ ─────► │  Auth · RBAC · Audit · Adapter · Webhooks  │ ─────► │ (UATHA/QA/PROD)  │
│  TanStack Query       │ ◄───── │              Prisma ORM                    │ ◄───── │                  │
│  dnd-kit builders     │        └────────────────┬────────────────────────────┘        └─────────────────┘
└──────────────────────┘                          │
                                                    ▼
                                          ┌───────────────────┐
                                          │  SQLite (dev/demo) │
                                          │  → Postgres-ready  │
                                          └───────────────────┘
                                                    ▲
                                                    │ POST /api/webhooks/fad
                                          ┌───────────────────┐
                                          │   FAD Webhooks     │
                                          └───────────────────┘
```

Ningún componente de UI llama directamente a la API de FAD. Todo pasa por el backend, y dentro
del backend todo pasa por `FadApiAdapter`. El frontend solo conoce la API interna
(`/api/...`).

## 2. Módulos del backend (`apps/backend/src`)

| Módulo | Responsabilidad |
|---|---|
| `modules/auth` | Login de usuarios de la consola (JWT en cookie httpOnly), bootstrap del primer admin |
| `modules/environments` | CRUD de `ApiEnvironment`, nunca devuelve secretos, solo flags `*Configured` |
| `modules/credentials` (`CredentialEncryptionService`) | Cifra/descifra secretos con AES-256-GCM, versión de cifrado, redacción para logs |
| `modules/fad-adapter` (`FadApiAdapter`) | Único punto de contacto con la API FAD: token OAuth (cache en memoria server-side + renovación anticipada), creación de validación, guardado de paso, consulta de pasos (método configurable), consulta detallada, prueba de conexión, adaptador *demo* quemado solo para seeds/tests |
| `modules/providers` | Catálogo editable de proveedores (`ProviderCatalogEntry`) |
| `modules/templates` | CRUD de `ValidationTemplate`, valida `requestConfig` contra `packages/validation-schemas` |
| `modules/executions` | Orquesta creación/consulta de validaciones, normaliza respuestas, persiste `ValidationExecution` / `ValidationStepExecution` |
| `modules/response-views` | CRUD de `ResponseView` (diseñador de respuestas) + motor de proyección seguro (sin `eval`) |
| `modules/webhooks` | Recepción idempotente, Basic Auth en tiempo constante, procesamiento desacoplado, catálogo de eventos |
| `modules/audit` | Registro y consulta de auditoría |
| `modules/users` | CRUD de usuarios + roles (ADMIN/OPERATOR/AUDITOR) |
| `modules/settings` | System settings (valores no secretos o cifrados) |
| `modules/media-proxy` | Proxy autenticado hacia archivos protegidos de FAD (nunca expone el token al navegador) |

Capas dentro de cada módulo: `*.routes.ts` (Express + Zod) → `*.service.ts` (lógica de
dominio) → Prisma (persistencia). El `FadApiAdapter` es la única pieza que sabe hablar HTTP con
FAD; ningún `service.ts` de otro módulo construye URLs de FAD directamente.

## 3. Normalización (packages/validation-schemas + backend/src/normalize)

Funciones puras, testeadas unitariamente: `normalizeCreateValidationResponse`,
`normalizeValidationStepResponse`, `normalizeValidationDataResponse`, `normalizeWebhookEvent`,
`normalizeValidationStatus`, `normalizeStepStatus`, `maskSensitiveData`, `parseFlexibleDate`.
Todas conservan `rawPayload` / `rawStatus` / `rawDate` sin modificar.

## 4. Seguridad de credenciales

`APP_ENCRYPTION_KEY` (32 bytes, base64) es la única variable sensible requerida para instalar.
Nunca se guarda en base de datos. `CredentialEncryptionService` cifra cada secreto con
AES-256-GCM (IV aleatorio de 12 bytes + auth tag, todo en un solo valor almacenado), y guarda
`encryptionVersion` para poder rotar el algoritmo/llave en el futuro sin migrar datos a mano.
El frontend nunca recibe un secreto guardado; solo banderas `*Configured: boolean`.

## 5. Frontend (`apps/frontend/src`)

- `routes/` con React Router: `/`, `/builder`, `/templates`, `/executions/new`,
  `/executions`, `/executions/:id`, `/response-designer`, `/webhooks`, `/environments`,
  `/catalogs`, `/users`, `/audit`, `/settings`, `/setup`.
- `features/` agrupa UI + hooks TanStack Query por dominio (mismo nombre que los módulos del
  backend).
- `components/builder/` implementa las 3 zonas del Constructor (catálogo, lienzo dnd-kit,
  panel de propiedades) + preview JSON sincronizado con el formulario (RHF + Zod resolver).
- `components/response-designer/` árbol navegable + editor de campo.
- Tema claro/oscuro vía variables CSS + `prefers-color-scheme`, accesible (WCAG AA), sin
  animaciones agresivas.

## 6. Persistencia y migración a Postgres

Prisma con `datasource db { provider = "sqlite" }` para desarrollo. El esquema evita
características específicas de SQLite (enums y JSON se modelan como `String`, validados en la
capa de aplicación — ver el encabezado de `prisma/schema.prisma`), por lo que es portable a
Postgres sin tocar lógica de dominio.

`prisma/postgresql/schema.prisma` es la variante real para desplegar en PostgreSQL — generada
mecánicamente desde `prisma/schema.prisma` por `scripts/build-postgresql-schema.mjs` (cambia
solo el bloque `datasource`, para no mantener dos archivos de ~500 líneas a mano), con su propio
historial de migraciones en `prisma/postgresql/migrations/` (el SQL de migración no es
intercambiable entre motores). Para desplegar en Postgres:

1. `DATABASE_URL` apuntando a la instancia de Postgres real.
2. `npm run db:postgresql:build` (regenera el esquema si `schema.prisma` cambió).
3. `npm run db:postgresql:migrate:deploy`.
4. Reiniciar el servidor.

Este proceso también está documentado y accionable desde la pestaña "Base de datos" del menú
(prueba de conexión real contra Postgres antes de aplicar el cambio) — ver
`apps/backend/src/modules/database-connection/`. MongoDB y una base de grafos (Neo4j) se pueden
seleccionar y guardar como preferencia ahí, pero no tienen una capa de acceso a datos
implementada todavía (requerirían un modelo de datos y un cliente distintos a Prisma+SQL).

## 7. Extensibilidad

- Nuevos pasos: agregar entrada a `STEP_CATALOG` (packages/shared-types) + esquema Zod
  opcional; si no hay esquema específico, el Constructor ofrece el editor JSON avanzado.
- Nuevos eventos de webhook: agregar a `WEBHOOK_EVENT_TYPES`; eventos no listados igual se
  persisten como `UNKNOWN` sin romper el endpoint.
- Nuevos renderers de validaciones externas: registrar en `EXTERNAL_VALIDATION_RENDERERS` por
  `resultKey`; sin registro, se usa el visor JSON genérico.
