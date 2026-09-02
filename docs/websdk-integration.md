# Integración "Web SDK" (captura embebida Acuant + Facetec)

Este documento describe el segundo modelo de integración de la consola — junto al original
"API REST (by-steps)" — en el que la captura de documento y la prueba de vida ocurren dentro del
navegador del operador, usando el paquete público `@fad-producto/fad-sdk` (inyección de iframes),
orquestado por esta consola en vez de ser un flujo alojado íntegramente por FAD.

Fuentes analizadas para esta implementación (nunca copiadas literalmente ni usadas como
credenciales): `FAD SDK Web Regula` (docx), `FAD SDK Web Facetec` (PDF), `FAD SDK Web Acuant`
(PDF), `Integration_saveValidationData_service` (PDF), y un proyecto Angular de referencia
(`fad-demo-v1`) que el propio autor describe como "verificado contra UATHA". Del proyecto de
referencia se tomó únicamente la **estructura** (endpoints, algoritmo de cifrado, formato del
.TAR): ningún secreto, token ni credencial de ese proyecto fue copiado a este repositorio — el
`environment.ts` de esa referencia contenía lo que parecían ser credenciales reales de un
ambiente UATHA (client secret OAuth, credenciales Acuant, un token de SDK); se ignoraron por
completo.

## Por qué el diseño difiere de la referencia (más seguro, mismo resultado)

El proyecto de referencia ejecuta **todo** desde el navegador: OAuth (con el `client_secret` en
el bundle), NAAT-CHECK, `compareFacesPassive`, `getValidationKeys` y el cifrado AES-256-CBC del
`.TAR` con `crypto-js`. Es funcional pero implica que el `client_secret` OAuth y el password del
usuario API viajan (o quedan embebidos) en código que corre en el dispositivo del cliente final.

Esta consola separa las responsabilidades:

- **En el navegador** (inevitable: así están diseñados los SDK de Acuant/Facetec — necesitan
  acceso directo a la cámara y abren su propio iframe): `startAcuant()` y `startFacetec()`. Reciben
  las credenciales de Acuant y el descriptor de middleware de Facetec porque el propio vendor lo
  exige para operar client-side — igual que en la referencia.
- **En el backend** (nunca en el navegador): autenticación OAuth (reutiliza
  `FadApiAdapter.getAccessToken`, con su mismo cache/renovación), `NAAT-CHECK`,
  `compareFacesPassive`, `getValidationKeys`, el empaquetado `.TAR` (`tar-writer.ts`), el cifrado
  AES-256-CBC + checksum (`websdk-crypto.ts`, con Node `crypto`, no `crypto-js`) y
  `saveValidationData`. El `client_secret` OAuth, el password del usuario API y la key/vector de
  cifrado **nunca** salen del proceso backend.
- El navegador solo le reporta al backend los **resultados ya capturados** (imágenes, OCR,
  selfie) vía `POST /api/executions/websdk/:id/acuant-result` y `.../facetec-result`; el backend
  hace todo lo demás y guarda el resultado normalizado.

## Modelo de datos

- `ApiEnvironment.integrationModel`: `API_BY_STEPS` (default) | `WEB_SDK`.
- `WebSdkConfig` (1:1 con `ApiEnvironment`, `prisma/schema.prisma`): URL/token del SDK,
  credenciales Acuant (cifradas), descriptor/credenciales de Facetec (cifradas si no se usa
  middleware), endpoints de CHECK/compareFaces/getValidationKeys/saveValidationData, y los
  umbrales de negocio (`checkMaxAttempts`, `checkAcceptedRisk`, `faceMatchMinConfidence`).
- `ValidationExecution.webSdkState`: estado transitorio (JSON) mientras el flujo está en curso
  (resultado de Acuant/Facetec, intentos de CHECK). Se limpia (`null`) cuando
  `completeWebSdkExecution` termina con éxito.

## Endpoints nuevos

| Método | Ruta | Qué hace |
|---|---|---|
| GET/PUT | `/api/environments/:id/websdk-config` | Configuración Web SDK del ambiente (ADMIN) |
| DELETE | `/api/environments/:id/websdk-config/credentials/:field` | Borra una credencial puntual |
| POST | `/api/executions/websdk/start` | Crea la ejecución y arma la config para iniciar los SDK en el navegador |
| POST | `/api/executions/websdk/:id/acuant-result` | Recibe la captura de Acuant, corre NAAT-CHECK (con reintentos) |
| POST | `/api/executions/websdk/:id/facetec-result` | Recibe la captura de Facetec (selfie, faceScan, auditTrail) |
| POST | `/api/executions/websdk/:id/complete` | compareFacesPassive → getValidationKeys → .TAR → cifrado → saveValidationData → normaliza |

El resultado final se guarda en `ValidationExecution.normalizedResponse` con la **misma** forma
canónica (`NormalizedValidationDetail`) que usan las ejecuciones API-by-steps — por eso la
pestaña "Reporte", `OcrTable`, `ImageGallery` y el resto del detalle de ejecución funcionan sin
ningún cambio, sin importar el modelo de integración.

## Flujo del operador (frontend)

`Nueva ejecución` (`NewExecutionPage`) distingue ambientes `WEB_SDK` (badge "Web SDK") y
redirige a `/executions/new-websdk?environmentId=...` (`WebSdkCapturePage`), un onboarding lineal
y sencillo de cara al cliente: selección de ambiente + datos del cliente → captura de documento
(con reintento automático si NAAT-CHECK rechaza, hasta `checkMaxAttempts`) → prueba de vida →
finalizar (compara, cifra, guarda) → redirige al detalle de la ejecución normal.

Todo el copy que ve el cliente en cada paso (título/texto de bienvenida, instrucciones de
documento y prueba de vida, mensaje al reintentar, mensaje de éxito/bloqueo, error genérico) es
configurable por ambiente en Ambientes → pestaña "Web SDK" → sección "Mensajes del onboarding"
(`WebSdkConfig.onboardingMessages`, ver `WebSdkOnboardingMessagesSchema`) — nunca texto embebido
en el código. Un ambiente recién creado ya trae mensajes neutros por defecto, así que el
onboarding funciona sin que el operador escriba nada.

La parametrización propia de cada SDK (colores/leyendas/vistas de `startAcuant`/`startFacetec`
vía `acuantConfiguration`/`facetecConfiguration`, qué extraer con `acuantParams`, captura manual
vs. automática, middleware de Facetec) también se edita ahí mismo — ver `WebSdkConfigForm.tsx`.

## Verificación realizada

- **Backend**: 24 pruebas unitarias/integración nuevas (`websdk-crypto.test.ts`,
  `tar-writer.test.ts`, `websdk-normalize.test.ts`, `websdk-flow.integration.test.ts`) — cifrado
  AES-256-CBC verificado por descifrado propio, formato `.TAR` verificado con un parser
  independiente, y el flujo completo (start → acuant-result → facetec-result → complete)
  verificado con `fetch` simulado (sin red real), incluyendo los casos de riesgo rechazado y
  match facial insuficiente.
- **Frontend**: configuración Web SDK y navegación del asistente verificadas en navegador real
  (Playwright) contra el backend real de esta consola.
- **No verificado** (y no se puede verificar sin credenciales reales, que este proyecto nunca
  usa): la ejecución real de `startAcuant()`/`startFacetec()` contra los servidores de Acuant y
  Facetec, ni una llamada real a `saveValidationData` de FAD. La lógica del lado del backend está
  implementada exactamente como documentan los PDF oficiales y el proyecto de referencia
  verificado, pero un primer uso contra un ambiente UATHA real de un cliente debe tratarse como
  una prueba piloto.

## Limitaciones conocidas / trabajo futuro

- **Regula** (motor alternativo de captura documental, además de Acuant) está soportado por
  `@fad-producto/fad-sdk` (`startRegula`) y documentado en el PDF `FAD SDK Web Regula`, pero no
  se implementó: no existe una referencia probada equivalente al proyecto Angular (que solo usa
  Acuant), y agregarlo sin verificación aumentaría el riesgo de un flujo de captura mal
  configurado. `WebSdkConfig.documentCaptureEngine` ya reserva el campo para esto.
  `DOCUMENT_CAPTURE_ENGINES` en `packages/shared-types/src/enums.ts` solo lista `ACUANT`; agregar
  `REGULA` ahí y el método `startRegula` en `apps/frontend/src/lib/fad-sdk-client.ts` es el punto
  de partida.
- Huellas dactilares, firma, video-acuerdo y demás módulos del SDK (`startIdentyFingerprints`,
  `startSignature`, `startVideoagreement`, etc.) tampoco están integrados; el flujo implementado
  cubre exactamente el camino documento→riesgo→vida→comparación→guardado del proyecto de
  referencia.
