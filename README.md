# FAD Biometrics Configuration & Results Console

Consola web para **configurar, ejecutar, administrar y visualizar** procesos de validación
biométrica contra **FAD** (Firma Autógrafa Digital / NA-AT Sovos), con dos modelos de
integración: **API REST (by-steps)**, donde FAD aloja el proceso y esta consola lo
configura/monitorea, y **Web SDK**, donde la captura de documento (Acuant) y la prueba de vida
(Facetec) corren embebidas en el navegador de esta consola (ver `docs/websdk-integration.md`).
Incluye: constructor visual de validaciones (drag & drop), formularios dinámicos, tema visual
personalizable, asistente de ejecución con enlace del proceso listo para compartir por código QR,
WhatsApp u otro canal, historial y detalle de validaciones con reporte automático, diseñador de
vistas de respuesta, recepción idempotente de webhooks, RBAC, auditoría y cifrado de credenciales.

> Ningún secreto real de FAD fue usado durante el desarrollo. Todas las credenciales, seeds y
> ejemplos de este repositorio son ficticios. Ver `docs/technical-analysis.md` y
> `docs/websdk-integration.md`.

## Instalación en 5 pasos

1. Instalar [Node.js](https://nodejs.org/) 20 o superior.
2. `npm install` (instala todo el monorepo y genera el cliente de Prisma).
3. Generar la llave de cifrado y guardarla en `.env`:
   ```bash
   npm run generate:encryption-key
   # copie la línea que imprime en un archivo .env en la raíz:
   echo "APP_ENCRYPTION_KEY=<valor-generado>" > .env
   ```
4. Ejecutar las migraciones y cargar datos de demostración:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
5. `npm run dev` — abre <http://localhost:5173> (backend en `:4000`, con proxy automático de `/api`).

Inicie sesión con uno de los usuarios de demostración impresos por `npm run db:seed`
(`admin@demo.local`, `operador@demo.local`, `auditor@demo.local`, `lanzador@demo.local`,
contraseña `Demo#Local2026!` para los cuatro — **cámbiela antes de usar la app fuera de su
máquina**).

Si prefiere no ejecutar el seed, la app funciona igual: al abrirla por primera vez sin usuarios
se muestra un **asistente de instalación** (crear administrador → configurar conexión opcional →
probar conexión → crear primera plantilla).

## Stack técnico

- **Frontend**: React + Vite + TypeScript + Tailwind CSS, componentes accesibles basados en
  Radix UI, React Router, React Hook Form + Zod, TanStack Query, dnd-kit.
- **Backend**: Node.js + Express + TypeScript, Prisma ORM, Zod.
- **Base de datos**: SQLite por defecto (cero configuración). Migrable a PostgreSQL cambiando
  `provider` en `prisma/schema.prisma` y `DATABASE_URL` — sin tocar lógica de dominio.
- **Monorepo**: npm workspaces (`apps/frontend`, `apps/backend`, `packages/shared-types`,
  `packages/validation-schemas`, `packages/ui`).

Ver la decisión completa (y por qué se eligió este stack sobre el de Next.js/Postgres sugerido en
otra sección del encargo original) en `docs/technical-analysis.md` §6.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Backend (`:4000`) + frontend (`:5173`) en modo desarrollo, con recarga en caliente |
| `npm run build` | Compila `packages/*`, backend y frontend para producción |
| `npm run start` | Ejecuta el backend compilado, sirviendo también el frontend compilado (`apps/frontend/dist`) en un solo proceso |
| `npm run lint` | ESLint sobre todo el monorepo |
| `npm run typecheck` | `tsc --noEmit` en cada paquete/app |
| `npm run test` | Pruebas unitarias e integración (Vitest) — backend, frontend y `validation-schemas` |
| `npm run test:e2e` | Pruebas end-to-end (Playwright) contra la app en ejecución — ver más abajo |
| `npm run db:migrate` | Aplica migraciones de Prisma (crea `prisma/dev.db` si no existe) |
| `npm run db:seed` | Carga datos de demostración ficticios |
| `npm run generate:encryption-key` | Genera una llave AES-256 (base64) para `APP_ENCRYPTION_KEY` |

Todos los scripts son multiplataforma (Windows, macOS, Linux) — no dependen de Bash.

### Pruebas end-to-end (Playwright)

`npm run test:e2e --workspace=apps/frontend` requiere que la app esté corriendo (o Playwright la
levanta automáticamente con `npm run dev`, ver `apps/frontend/playwright.config.ts`) y que exista
el usuario `admin@demo.local` (`npm run db:seed`). En entornos con Chromium preinstalado en una
ruta no estándar, indique el binario con:
```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/a/chromium npm run test:e2e --workspace=apps/frontend
```

## Variables de entorno

Archivo `.env` en la raíz (no versionado; ver `.env.example`):

```env
APP_ENCRYPTION_KEY=
```

Es la **única variable sensible** requerida. Cifra en reposo (AES-256-GCM) las credenciales de
cada ambiente FAD guardadas en base de datos (Basic Auth, usuario/contraseña de API, credenciales
de webhook). Nunca se guarda en la base de datos ni se envía al navegador.

Variables opcionales (todas con valor por defecto sensato):

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `4000` | Puerto del backend |
| `DATABASE_URL` | `file:./prisma/dev.db` (definido en `prisma/.env`, no sensible) | Conexión de base de datos |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido en producción |
| `PUBLIC_APP_URL` | igual a `CORS_ORIGIN` | Origen público usado para armar los enlaces de captura Web SDK compartidos (`/v/:token`) — cámbielo al dominio real en producción |
| `NODE_ENV` | `development` | `production` activa cookies `secure`, HSTS y sirve el frontend compilado |

## Docker (alternativo, no obligatorio)

```bash
docker compose up --build
# o
docker build -t fad-console . && docker run -p 4000:4000 -e APP_ENCRYPTION_KEY=<valor> fad-console
```

El contenedor aplica migraciones automáticamente al iniciar (`docker-entrypoint.sh`) y sirve todo
en un solo proceso (`:4000`). Los datos persisten en un volumen (`fad-console-data`).

## Configurar una conexión real con FAD

1. Inicie sesión como `ADMIN` y vaya a **Configuración → Conexiones API**.
2. Cree un ambiente (nombre, tipo UATHA/QA/PRODUCTION, URL base).
3. En la pestaña **Autenticación OAuth**, cargue el usuario/contraseña de Basic Auth y el
   usuario/contraseña de la API. Indique si la contraseña ya viene cifrada con SHA-256
   (`passwordIsPreHashed`) — si no, la consola la hashea una sola vez antes de enviarla.
4. Pulse **Probar conexión**. El resultado solo indica éxito/fallo — nunca se muestra el token.
5. (Opcional) En **Endpoints**, ajuste el método HTTP de `getValidationStep` (por defecto `GET`,
   confirmado en la colección Postman UATHA) o una `launchUrlTemplate` si su integración expone
   una URL de proceso (no documentada por FAD; queda vacía y nunca se infiere).
6. En **Webhooks**, configure usuario/contraseña que FAD debe usar contra
   `POST {su-dominio}/api/webhooks/fad` (Basic Auth, comparación en tiempo constante).

Hasta que un ambiente tenga usuario/contraseña de API configurados, el botón "Ejecutar
validación" en el asistente de nueva ejecución permanece deshabilitado con el mensaje exigido:
*"Debes configurar una conexión API antes de ejecutar la validación."* — pero **Simular en modo
DEMO** siempre está disponible (usa fixtures sanitizados, nunca se presenta como conexión real;
toda ejecución así queda marcada `isDemo: true`).

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/technical-analysis.md`](docs/technical-analysis.md) | Contratos confirmados, inconsistencias de la documentación fuente y cómo se resolvieron, decisión de stack |
| [`docs/architecture.md`](docs/architecture.md) | Módulos, capas, diagrama de flujo, extensibilidad |
| [`docs/api-contracts.md`](docs/api-contracts.md) | Referencia campo por campo de cada servicio FAD y evento de webhook |
| [`docs/security-decisions.md`](docs/security-decisions.md) | Cifrado, RBAC, redacción de logs, protección SSRF, limitaciones y riesgos conocidos |
| [`docs/implementation-plan.md`](docs/implementation-plan.md) | Fases de construcción ejecutadas |
| [`docs/openapi.yaml`](docs/openapi.yaml) | Especificación OpenAPI 3.0 de la API interna (`/api/*`) |

## Roles

| Rol | Puede |
|---|---|
| `ADMIN` | Todo: ambientes, secretos, plantillas, vistas, usuarios, catálogos, auditoría, mensajería |
| `OPERATOR` | Construir plantillas, ejecutar validaciones, consultar resultados — no toca secretos ni usuarios |
| `AUDITOR` | Solo lectura, ve auditoría y trazabilidad; información sensible siempre enmascarada |
| `LAUNCHER` | Solo enviar procesos (ejecutar validaciones, generar/enviar enlaces Web SDK) y ver su resultado — sin acceso a ninguna pantalla de configuración |

## Limitaciones conocidas

- El cifrado AES/CBC/PKCS5Padding del **SDK biométrico oficial** no está implementado — el
  endpoint de guardado de paso (`POST /api/executions/:id/steps/:stepKey/save`) es un módulo
  técnico avanzado que reenvía un payload ya cifrado provisto por el llamador, sin generar ni
  simular datos biométricos reales (fuera de alcance según el encargo).
- Los pasos `enrollFace`/`authFace` están marcados como experimentales: el PDF los documenta,
  pero ni el PDF ni la colección Postman confirman que el endpoint de creación los acepte.
- El build de Docker fue revisado manualmente (multi-stage, migración automática al iniciar) pero
  no pudo ejecutarse dentro de este entorno de desarrollo por no contar con un daemon Docker
  disponible; valide `docker compose up --build` en su máquina antes de depender de él en
  producción.
- Ver `docs/security-decisions.md` para el resto de riesgos y decisiones documentadas.

## Procedimiento sugerido para producción

1. Ejecutar `npm run build`.
2. Definir `DATABASE_URL` apuntando a PostgreSQL (cambiar `provider` en `prisma/schema.prisma` a
   `postgresql`) y correr `npm run db:migrate:deploy`.
3. Generar una `APP_ENCRYPTION_KEY` nueva y exclusiva del ambiente de producción
   (`npm run generate:encryption-key`), gestionada por su secret manager (nunca en el repositorio).
4. Definir `NODE_ENV=production`, `CORS_ORIGIN` con el dominio real, servir detrás de HTTPS/TLS
   (terminación en el balanceador o proxy inverso).
5. `npm run start` (o el contenedor Docker) detrás de un proceso supervisor (systemd, PM2, o el
   orquestador de su elección).
6. Configurar el primer ambiente desde **Configuración → Conexiones API** con credenciales reales
   y ejecutar **Probar conexión** antes de habilitar ejecuciones reales.
7. Configurar la URL pública de webhook en FAD apuntando a `https://su-dominio/api/webhooks/fad`
   con las credenciales Basic Auth definidas en el mismo ambiente.
