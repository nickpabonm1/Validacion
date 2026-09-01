# Plan de implementación

Fases ejecutadas en este repositorio (ver historial de commits para el detalle incremental):

1. **Análisis** (este directorio `docs/`): contratos, arquitectura, decisiones de seguridad.
2. **Base del proyecto**: monorepo npm workspaces, TypeScript estricto, ESLint/Prettier,
   Prisma + SQLite, Docker opcional.
3. **Modelo de datos + Auth/RBAC**: entidades de la sección 20 del brief, login,
   `requireRole`, asistente de instalación (bootstrap admin).
4. **Ambientes, secretos y adaptador FAD**: `ApiEnvironment`, `CredentialEncryptionService`,
   `FadApiAdapter` (auth, createValidation, saveValidationStep, getValidationStep,
   getValidationData, testConnection), catálogo de proveedores.
5. **Constructor de validación**: catálogo de pasos, lienzo dnd-kit, panel de propiedades,
   form builder para `formValidationId`, theme builder, preview JSON, import/export, guardar
   como plantilla.
6. **Ejecuciones**: asistente de 7 pasos, historial con filtros, detalle con timeline de pasos,
   consulta de estado, JSON original vs normalizado.
7. **Diseñador de respuestas**: árbol navegable, configuración de campo, vistas
   ejecutiva/operativa/técnica, motor de proyección seguro (sin `eval`).
8. **Webhooks**: endpoint idempotente, Basic Auth en tiempo constante, catálogo de eventos,
   visor de eventos y reintentos.
9. **Pruebas, seguridad, documentación**: Vitest (unitarias + integración con servidor FAD
   simulado), Playwright (smoke e2e), Helmet/CORS/rate limiting, README y este set de
   documentos.

Cada fase se valida con `npm run lint`, `npm run typecheck` y `npm run test` en los paquetes
afectados antes de continuar a la siguiente. Ver el `README.md` raíz para comandos de
ejecución, variables de entorno y la guía de conexión de credenciales reales.
