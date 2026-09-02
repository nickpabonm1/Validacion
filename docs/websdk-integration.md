# Integración "Web SDK" (captura embebida Acuant + Facetec)

Este documento describe el segundo modelo de integración de la consola — junto al original
"API REST (by-steps)" — en el que la captura de documento y la prueba de vida ocurren dentro del
navegador del operador, usando el paquete público `@fad-producto/fad-sdk` (inyección de iframes),
orquestado por esta consola en vez de ser un flujo alojado íntegramente por FAD.

Fuentes analizadas para esta implementación (nunca copiadas literalmente ni usadas como
credenciales): `FAD SDK Web Regula` (docx), `FAD SDK Web Facetec` (PDF), `FAD SDK Web Acuant`
(PDF), `FAD SDK Web CaptureId` (PDF), `Integration_saveValidationData_service` (PDF), y dos
proyectos Angular de referencia — `fad-demo-v1` (Acuant/Regula/Facetec) y `fad-demo-v2`
(agrega CaptureId, ahí documentado como proveedor "Sovos") — que el propio autor describe como
"verificados contra UATHA". De ambos proyectos de referencia se tomó únicamente la **estructura**
(endpoints, algoritmo de cifrado, formato del .TAR, forma de las respuestas de cada SDK): ningún
secreto, token ni credencial de esos proyectos fue copiado a este repositorio — el
`environment.ts`/`environment.prod.ts` de ambas referencias contenían lo que parecían ser
credenciales reales de un ambiente UATHA (client secret OAuth, credenciales Acuant, licencia
Regula, un token de SDK); se ignoraron por completo.

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
En vez de escribir cada campo a mano, «Importar configuración (JSON)» carga un archivo con el
mismo shape que `WebSdkConfigInput` (ver `docs/examples/websdk-config.example.json` y
`apps/frontend/src/lib/websdk-config-import.ts`) — análogo a «Importar colección Postman» de
Ambientes, pero en el formato propio de esta consola en vez de interpretar una colección ajena.
Un ambiente Web SDK **no** muestra el botón de Postman (no aplica: ese formato describe
endpoints REST de FAD, no la configuración de los SDK de Acuant/Facetec).

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
  usa): la ejecución real de `startAcuant()`/`startRegula()`/`startFacetec()` contra los
  servidores de Acuant, Regula y Facetec, ni una llamada real a `saveValidationData` de FAD. La
  lógica del lado del backend está
  implementada exactamente como documentan los PDF oficiales y el proyecto de referencia
  verificado, pero un primer uso contra un ambiente UATHA real de un cliente debe tratarse como
  una prueba piloto.

## Regula (motor alternativo de captura documental)

Implementado según `FAD_SDK_Web_Regula_current_Version_1.docx` — un ambiente Web SDK elige
`documentCaptureEngine: ACUANT | REGULA` (Ambientes → pestaña «Web SDK» → «Motor de captura»); es
mutuamente excluyente con Acuant, igual que documenta el SDK. `runRegulaCapture` en
`apps/frontend/src/lib/fad-sdk-client.ts` normaliza el resultado a la misma forma
(`WebSdkAcuantResultInput`) que usa Acuant, así que el resto del flujo (NAAT-CHECK,
compareFacesPassive, saveValidationData, el reporte) funciona igual sin importar el motor.

Diferencias de forma frente a Acuant que sí se modelaron explícitamente (ver
`websdk-normalize.ts`/`fad-sdk-client.ts`):
- `data.id.front`/`data.id.back` vienen como `string` directo (Acuant los anida en
  `id.front.image.data`).
- `data.originalPhoto` (imagen original antes de recorte) no tiene equivalente en Acuant — se
  muestra como un `mediaAsset` más.
- `data.regulaData`/`data.regulaResponse` (datos crudos del proveedor) se preservan sin
  interpretar en `externalValidations`, nunca se descartan ni se fabrican.
- `alerts` llega agrupado por categoría (`authenticity`, `dateChecks`, `imageQuality`,
  `mrzCheckDigit`, `textCrossChecks`) en vez del array plano de Acuant — `flattenRegulaAlerts` lo
  aplana a un array único con `category` en cada entrada para reutilizar el mismo renderizador de
  alertas del reporte.

**Discrepancia encontrada entre el docx y el paquete real instalado** (`@fad-producto/fad-sdk`,
ver `node_modules/@fad-producto/fad-sdk/dist/types/fad-sdk.d.ts`) — se siguió el paquete real, no
la prosa del docx, porque es lo que efectivamente se ejecuta en el navegador:
- El docx documenta `startRegula(credentials, idData, idPhoto, captureType, configuration)`; la
  firma real del paquete instalado es `startRegula(credentials, captureType, idData, idPhoto,
  configuration)` — el orden de `captureType` cambia.
- El docx documenta un tercer `captureType` (`DESKTOP`, "carga de archivo"); el enum
  `RegulaCaptureType` del paquete instalado solo define `CAMERA_SNAPSHOT` y `DOCUMENT_READER`
  (ver `constants/regula/card-type/regula-capture-type.enum.d.ts`) — por eso
  `REGULA_CAPTURE_TYPES` en `packages/shared-types/src/enums.ts` solo lista esos dos. El JSDoc del
  método sí menciona un "desktop process" cuyo `captureType` "will be ignored", lo que sugiere que
  ese modo se activa vía `configuration.captureSource`/`capture.desktop` (documentado en el docx)
  en vez de por un valor de `captureType` propio.

## CaptureId (tercer motor de captura documental)

Implementado según `FAD SDK Web CaptureId` (PDF, 26 páginas) y contrastado contra un segundo
proyecto Angular de referencia (`fad-demo-v2`, `FadSdkService.startCaptureId`/`mapCaptureId`) —
igual que con `fad-demo-v1`, solo se tomó la **estructura**: el `environment.ts` de `fad-demo-v2`
también contenía lo que parecían ser credenciales reales de un ambiente UATHA (client secret
OAuth, credenciales Acuant, licencia Regula, token del SDK) y se ignoraron por completo, nunca se
copiaron a este repositorio.

Un ambiente Web SDK elige `documentCaptureEngine: ACUANT | REGULA | CAPTURE_ID` (Ambientes →
pestaña «Web SDK» → «Motor de captura»); es mutuamente excluyente con Acuant/Regula, igual que
documenta el SDK. Diferencia clave frente a los otros dos motores: `startCaptureId(configuration)`
recibe **un único parámetro** — no hay `credentials` propias, se autentica con el mismo `sdkToken`
(o el `access_token` de respaldo) que ya usan Acuant/Facetec. Por eso `WebSdkConfig` no tiene
columnas cifradas para este motor: solo `captureIdParams` (`{ idPhoto, originalPhoto }`, se
inyectan en `configuration.output` al construir el `sdkInit`, mismo patrón que
`FadSdkService.startCaptureId` de la referencia) y `captureIdConfiguration` (JSON libre, sin
secretos).

`runCaptureIdCapture` en `apps/frontend/src/lib/fad-sdk-client.ts` normaliza el resultado a la
misma forma (`WebSdkAcuantResultInput`) que Acuant/Regula, así que el resto del flujo (NAAT-CHECK,
compareFacesPassive, saveValidationData, el reporte) funciona igual sin importar el motor:
- La respuesta trae las imágenes bajo `data.resources.{croppedId,originalPhoto,portrait}` (no
  documentado en el PDF con este nivel de detalle) en vez de `data.id.front/back` (Acuant/Regula);
  se extraen con un `pickImage` tolerante a varias formas (string directo, `{data}`, `{image}`,
  etc.), puerto del mismo helper de `fad-demo-v2`.
- El OCR (`data.ocr.fields` + `data.ocr.decodeInfo.data.biograficos`, este último poblado solo
  cuando se decodifica el QR de una INE) se remapea a los mismos nombres camelCase que ya usa
  Acuant (`givenName`, `fathersSurname`, `curp`, etc.) para que `buildMetadataJson` (el `data.json`
  del `.TAR`) funcione sin cambios sin importar el motor.
- `qualityAssessment`/`traceability`, que el PDF sí documenta en la respuesta, no se normalizan a
  un campo propio (ningún proveedor los usa aguas abajo en este flujo) — quedan disponibles en
  `raw`, sin fabricarlos ni descartarlos.

## Limitaciones conocidas / trabajo futuro

- Huellas dactilares, firma, video-acuerdo y demás módulos del SDK (`startIdentyFingerprints`,
  `startSignature`, `startVideoagreement`, etc.) tampoco están integrados; el flujo implementado
  cubre exactamente el camino documento→riesgo→vida→comparación→guardado del proyecto de
  referencia.
