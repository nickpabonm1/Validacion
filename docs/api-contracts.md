# Contratos de la API FAD (referencia interna)

Fuente: `API FAD Web Biometrics By Steps.pdf` v1.4 (26/11/2025) y
`Webhooks Service Definition (client).pdf` v1.3 (12/11/2024), contrastados con la colección
Postman `FAD-BIOMETRICS-ValidationSteps Autentic COL UATHA` (ambiente UATHA). Ningún valor de
ejemplo con datos reales de cliente fue reutilizado; los ejemplos aquí son ficticios.

## Autenticación

```
POST {baseUrl}/authorization-server/oauth/token
Authorization: Basic <base64(basicAuthUsername:basicAuthPassword)>
Content-Type: application/x-www-form-urlencoded

grant_type=password&username={apiUsername}&password={SHA256(apiPassword) | apiPassword si passwordIsPreHashed}
```

Éxito `200`:
```json
{ "access_token": "...", "token_type": "bearer", "refresh_token": "...", "expires_in": 43199,
  "scope": "profile", "jti": "..." }
```

Error:
```json
{ "error": "invalid_grant", "error_description": "Bad credentials" }
```
Catálogo de `error`: `access_denied`, `insufficient_scope`, `invalid_client`, `invalid_grant`,
`invalid_request`, `invalid_scope`, `invalid_token`, `redirect_url_mismatch`,
`unauthorized_client`, `unsupported_grant_type`, `unsupported_response_type`.

## Crear validación

```
POST {baseUrl}/biometrics-by-steps/validations
Authorization: Bearer {access_token}
Content-Type: application/json
```
Body: ver `packages/validation-schemas/src/fad/create-validation-request.schema.ts` (refleja
`processName, validity, client{name,mail,phone}, steps{...}, customization{theme,header},
feature.redirect.url, notifications{email,whatsapp}`).

Éxito:
```json
{ "success": true, "error": null, "code": 0,
  "data": { "key": "...", "vector": "...", "validationId": "..." } }
```
Error: `{ "success": false, "error": "the step 'test' is not valid", "code": 500, "data": null }`

`data.key` y `data.vector` son sensibles: nunca se registran completos en logs/auditoría, se
enmascaran en UI por defecto y requieren acción explícita para revelarse.

## Guardar paso

```
POST {baseUrl}/validation/saveValidationStep/{validationId}
Authorization: Bearer {access_token}
Content-Type: application/json
Body: <JSON cifrado AES/CBC/PKCS5Padding generado por el SDK, como string>
```
Éxito: `{ "success": true, "error": null, "code": 0, "data": { "validationId": "..." } }`
Errores documentados: `Internal error`, `incorrect data encryption`,
`No logramos recuperar los datos del usuario...`, `no logramos des-encriptar el archivo`.

## Consultar pasos

```
{método configurable} {baseUrl}/validation/getValidationStep/{validationId}
Authorization: Bearer {access_token}
```
- Documentado como `POST`. **Comprobado como `GET` en la colección UATHA.**
- Método configurable por ambiente (`getValidationStepHttpMethod`), default `GET` en UATHA.

Éxito: `data.processName`, `data.validation.{idProcess,status}`, `data.client`, `data.steps.*`
(`order,status,show,configuration,features,data`), `data.validationKeys{key,vector,validationId}`.
`data.validation.status` observado: `EN_PROCESO`, y documentado también `PENDING`,
`COMPLETED`.

## Consultar información detallada

```
POST {baseUrl}/validation/validations/getValidationData/{validationId}
Authorization: Bearer {access_token}
```
Respuesta con muchos campos opcionales (ver `technical-analysis.md` §1.5). `data.status`
observado `TERMINADO`; documentado también `Completed/Pending/In progress`. `data.result`
observado `Aprobado`; documentado también `Approved/Rejected`.

## Estructuras JSON por paso (SDK)

Base común: `client`, `base.idProcess`, `base.device.{appVersion,platform,deviceModel,
deviceName,operatingSystem,serialNumber,browser}`, `base.location.{latitude,longitude}`,
`step.{name,start,end}`. Estructuras específicas de `validation` por paso: `location`,
`privacyNotice` (`privacyNoticeAccepted`), `captureId` (Acuant `providerId=2`: `classification,
idData.ocr[], idData.alerts[], files[]`; Regula `providerId=1`: `classification, idData.ocr[],
idData.classification, files[]`), `formValidationId` (`providerId, form[{key,value}]`),
`idDetection` (`startSecond, files[]` con nombres fijos `image_id_detection_id_mex_front/back`,
`image_id_detection_selfie`, `video_id_detection`), `liveness` (`providerId, files[]` con
`image_liveness_selfie`), `fingerprints` (`processType, hand.{left,right}.<dedo>.{nfiq,
files[]}`, formatos `wsq`/`jpeg`), `enrollFace` (`id, file{file,name,type}` — experimental),
`authFace` (`face` base64 — experimental).

> Nota: los IDs de proveedor (`providerId`) **no son consistentes entre el PDF y la colección**
> (Acuant aparece como `1` en el PDF y como `2` en el ejemplo real de Postman para
> `features.provider`). Por eso el catálogo de proveedores es editable y no se hardcodea la
> relación proveedor↔ID en el código.

## Validaciones externas (post-proceso)

`accuant_validation` (`validation_result, skipped/invalid/valid_acceptance_criteria`),
`comparison_selfie_ine_validation` (`+ validation_comparison_percentage`),
`validation_big_data_corp_decision_check/pessoa` (`+ cpf`),
`validation_big_data_corp_empresa` (`+ cnpj`),
`validation_big_data_corp_pessoa_kyc` (`+ cpf`),
`validation_serpro` (`service_fingers_response_status, has_fingers,
both_face_and_digitais_validation, has_selfie, service_face_response_status`),
`validation_unico` (`unico_face_match_validation_uuid, has_selfie, cpf,
unico_face_match_result_done`).

## Webhooks

```
POST {urlPúblicaDelCliente}
Authorization: Basic <usuario:contraseña definidos por el cliente> (opcional según doc, recomendado)
Content-Type: application/json
```
Envelope: `{ id, idUser, event, creationDate: "DD/MM/YYYY HH:mm:ss", data, retry, error, idOriginal }`.
Se debe responder `2xx` rápido; cualquier código distinto de 200 provoca reintento del lado de
FAD (hasta 5, configurable del lado de FAD).

Eventos de biometría: `CREATED_VALIDATION_STEP {key,vector,validationId}`,
`RESULT_VALIDATION_STEP {success,error,code,data:{validation_result,...}}`,
`COMPLETED_VALIDATION_STEP {validationName,endDate,validationId}`,
`COMPLETED_VALIDATION {validationName,startDate,endDate,validationId,result}`,
`VALIDATION_CHANGE_STATUS {validationId,result,status}`.

Eventos FAD/FEA de firma (aceptados y persistidos, sin UI dedicada en v1): `CREATE_OTP`,
`CREATE_REQUISITION`, `SIGNED_REQUISITION`, `REJECTED_REQUISITION`,
`REJECTED_USER_REQUISITION`, `CANCEL_REQUISITION`, `EXPIRED_REQUISITION`,
`REQUISITION_PART_SIGNED`, `CREATE_FEA_REQUISITION`, `CREATE_FAD_REQUISITION_BY_FEA`,
`REJECTED_FEA_DOCUMENT`, `EXPIRED_FEA_REQUISITION`, `SIGNED_FEA_DOCUMENT_BY_FAD`,
`SIGNED_FEA_DOCUMENT`, `REJECTED_FEA_DOCUMENT_BY_FAD`, `PART_SIGNED_FEA_DOCUMENT`,
`FULLY_SIGNED_FEA_REQUISITION`.
