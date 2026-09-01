/**
 * Semillas de demostración. Todos los datos son FICTICIOS y están marcados como DEMO.
 * No se reutiliza ningún nombre, correo, teléfono, documento, URL privada, token ni
 * validationId proveniente de la documentación fuente (ver docs/technical-analysis.md).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PROVIDER_CATALOG } from "@fad-console/shared-types";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo#Local2026!";

async function upsertUser(name: string, email: string, role: "ADMIN" | "OPERATOR" | "AUDITOR") {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, passwordHash, role, active: true },
  });
}

async function main() {
  console.log("Sembrando datos de demostración (ficticios)...");

  const admin = await upsertUser("Admin Demo", "admin@demo.local", "ADMIN");
  await upsertUser("Operador Demo", "operador@demo.local", "OPERATOR");
  await upsertUser("Auditor Demo", "auditor@demo.local", "AUDITOR");

  for (const provider of DEFAULT_PROVIDER_CATALOG) {
    await prisma.providerCatalogEntry.upsert({
      where: { providerKey: provider.providerKey },
      update: {},
      create: {
        providerKey: provider.providerKey,
        providerLabel: provider.providerLabel,
        providerType: provider.providerType,
        externalProviderId: provider.defaultProviderId,
        enabled: provider.enabled,
        metadata: "{}",
      },
    });
  }

  const environment = await prisma.apiEnvironment.upsert({
    where: { id: "demo-environment" },
    update: {},
    create: {
      id: "demo-environment",
      name: "Demo (sin credenciales)",
      description:
        "Ambiente de demostración creado por el seed. No tiene credenciales configuradas: " +
        "las funciones de diseño y previsualización están disponibles, pero ejecutar una " +
        "validación real requiere que un administrador configure una conexión en " +
        "Configuración > Conexiones API.",
      environmentType: "UATHA",
      baseUrl: "https://demo.example.invalid",
      active: true,
      connectionStatus: "NOT_CONFIGURED",
    },
  });

  const basicTemplateConfig = {
    processName: "Validación básica Colombia (DEMO)",
    validity: 5,
    client: { name: "Nombre del cliente", mail: "cliente@ejemplo.com", phone: "+573000000000" },
    steps: {
      location: { order: 1, show: true, configuration: {}, features: {} },
      privacyNotice: {
        order: 2,
        show: true,
        configuration: {
          title: "Aviso de privacidad",
          content: "Texto de ejemplo del aviso de privacidad.",
          mandatory: true,
        },
        features: {},
      },
      formValidationId: {
        order: 3,
        show: true,
        configuration: {},
        features: {},
        input: {
          forms: [
            {
              default: true,
              fields: [
                {
                  id: "name",
                  inputType: "text",
                  label: "Nombre completo",
                  required: true,
                  order: 0,
                  visible: true,
                },
                {
                  id: "documentNumber",
                  inputType: "document number",
                  label: "Número de documento",
                  required: true,
                  order: 1,
                  visible: true,
                },
              ],
            },
          ],
        },
      },
    },
    customization: { theme: [], header: [] },
    feature: {},
    notifications: { email: false, whatsapp: false },
  };

  const advancedTemplateConfig = {
    processName: "Documento + prueba de vida (DEMO)",
    validity: 5,
    client: { name: "Nombre del cliente", mail: "cliente@ejemplo.com", phone: "+573000000000" },
    steps: {
      location: { order: 1, show: true, configuration: {}, features: {} },
      captureId: {
        order: 2,
        show: true,
        configuration: { captureFront: true, captureBack: true, country: "COL" },
        features: { provider: 1 },
      },
      liveness: {
        order: 3,
        show: true,
        configuration: {},
        features: { provider: 1, viewRequired: true },
      },
    },
    customization: {
      theme: [
        { key: "--fad-common-primary-color", value: "#005b95" },
        { key: "--fad-common-secondary-color", value: "#00b5e1" },
      ],
      header: [],
    },
    feature: {},
    notifications: { email: false, whatsapp: false },
  };

  const basicTemplate = await prisma.validationTemplate.upsert({
    where: { id: "demo-template-basic" },
    update: {},
    create: {
      id: "demo-template-basic",
      name: "Colombia — Básica (DEMO)",
      description: "Plantilla de ejemplo: ubicación, aviso de privacidad y formulario.",
      environmentId: environment.id,
      requestConfig: JSON.stringify(basicTemplateConfig),
      active: true,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  await prisma.validationTemplate.upsert({
    where: { id: "demo-template-advanced" },
    update: {},
    create: {
      id: "demo-template-advanced",
      name: "Documento + prueba de vida (DEMO)",
      description: "Plantilla de ejemplo con captureId y liveness.",
      environmentId: environment.id,
      requestConfig: JSON.stringify(advancedTemplateConfig),
      active: true,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  const executiveView = {
    fields: [
      { id: "f1", path: "status", label: "Estado", group: "Resumen", order: 0, visible: true, showOnlyIfHasValue: false, renderType: "STATUS", sensitivity: "INTERNAL" },
      { id: "f2", path: "result", label: "Resultado", group: "Resumen", order: 1, visible: true, showOnlyIfHasValue: false, renderType: "BADGE", sensitivity: "INTERNAL" },
      { id: "f3", path: "client.nameMasked", label: "Cliente", group: "Resumen", order: 2, visible: true, showOnlyIfHasValue: false, renderType: "MASKED", sensitivity: "SENSITIVE" },
      { id: "f4", path: "comparisonPercentage", label: "% Comparación", group: "Resumen", order: 3, visible: true, showOnlyIfHasValue: true, renderType: "PERCENTAGE", sensitivity: "INTERNAL" },
      { id: "f5", path: "startedAt", label: "Fecha de inicio", group: "Resumen", order: 4, visible: true, showOnlyIfHasValue: false, renderType: "DATETIME", sensitivity: "INTERNAL" },
      { id: "f6", path: "completedAt", label: "Fecha de finalización", group: "Resumen", order: 5, visible: true, showOnlyIfHasValue: true, renderType: "DATETIME", sensitivity: "INTERNAL" },
      { id: "f7", path: "alerts", label: "Alertas principales", group: "Estado del proceso", order: 6, visible: true, showOnlyIfHasValue: true, renderType: "LIST", sensitivity: "INTERNAL" },
    ],
  };

  const technicalView = {
    fields: [
      { id: "t1", path: "validationId", label: "Validation ID", group: "Información técnica", order: 0, visible: true, showOnlyIfHasValue: false, renderType: "TEXT", sensitivity: "INTERNAL" },
      { id: "t2", path: "rawStatus", label: "Estado original (raw)", group: "Información técnica", order: 1, visible: true, showOnlyIfHasValue: false, renderType: "TEXT", sensitivity: "INTERNAL" },
      { id: "t3", path: "device", label: "Dispositivo", group: "Dispositivo", order: 2, visible: true, showOnlyIfHasValue: true, renderType: "JSON", sensitivity: "INTERNAL" },
      { id: "t4", path: "network", label: "Red", group: "Red", order: 3, visible: true, showOnlyIfHasValue: true, renderType: "JSON", sensitivity: "INTERNAL" },
      { id: "t5", path: "location", label: "Geolocalización", group: "Geolocalización", order: 4, visible: true, showOnlyIfHasValue: true, renderType: "COORDINATES", sensitivity: "INTERNAL" },
      { id: "t6", path: "ocr", label: "Datos OCR", group: "Datos OCR", order: 5, visible: true, showOnlyIfHasValue: true, renderType: "TABLE", sensitivity: "SENSITIVE" },
      { id: "t7", path: "externalValidations", label: "Validaciones externas", group: "Validaciones externas", order: 6, visible: true, showOnlyIfHasValue: true, renderType: "JSON", sensitivity: "INTERNAL" },
      { id: "t8", path: "raw", label: "Respuestas originales", group: "Información técnica", order: 7, visible: true, showOnlyIfHasValue: false, renderType: "JSON", sensitivity: "INTERNAL" },
    ],
  };

  await prisma.responseView.upsert({
    where: { id: "demo-view-executive" },
    update: {},
    create: {
      id: "demo-view-executive",
      name: "Vista ejecutiva",
      description: "Resumen para usuarios comerciales/operativos.",
      kind: "EXECUTIVE",
      configuration: JSON.stringify(executiveView),
      isDefault: true,
    },
  });

  await prisma.responseView.upsert({
    where: { id: "demo-view-technical" },
    update: {},
    create: {
      id: "demo-view-technical",
      name: "Vista técnica",
      description: "Detalle completo para usuarios técnicos.",
      kind: "TECHNICAL",
      configuration: JSON.stringify(technicalView),
      isDefault: false,
    },
  });

  const demoExecutionId = "demo-execution-1";
  const demoRequestPayload = { ...basicTemplateConfig, processName: "Onboarding DEMO #1" };
  const demoNormalized = {
    validationId: "demo-0000-0000-0000-000000000001",
    processName: "Onboarding DEMO #1",
    environmentName: environment.name,
    templateName: basicTemplate.name,
    status: "COMPLETED",
    rawStatus: "TERMINADO",
    result: "APPROVED",
    rawResult: "Aprobado",
    client: {
      name: null,
      nameMasked: "N*** DEMO",
      email: null,
      emailMasked: "c***@ejemplo.com",
      phone: null,
    },
    steps: [
      { key: "location", label: "Ubicación", order: 1, show: true, status: "COMPLETED", rawStatus: "COMPLETED", configuration: {}, features: {}, data: null, startedAt: null, completedAt: null, durationSeconds: null },
      { key: "privacyNotice", label: "Aviso de privacidad", order: 2, show: true, status: "COMPLETED", rawStatus: "COMPLETED", configuration: {}, features: {}, data: { privacyNoticeAccepted: true }, startedAt: null, completedAt: null, durationSeconds: null },
      { key: "formValidationId", label: "Formulario de validación", order: 3, show: true, status: "COMPLETED", rawStatus: "COMPLETED", configuration: {}, features: {}, data: null, startedAt: null, completedAt: null, durationSeconds: null },
    ],
    progressPercent: 100,
    startedAt: "2026-01-01T10:00:00.000Z",
    completedAt: "2026-01-01T10:06:00.000Z",
    lastSyncedAt: "2026-01-01T10:06:00.000Z",
    comparisonPercentage: 99.5,
    ocr: { documentNumber: "0000000000", fullName: "CLIENTE DEMO" },
    classification: { countryCode: "COL", cardType: 4, cardTypeDescription: "Identification Card" },
    files: [],
    device: { platform: "Chrome 120", operatingSystem: "Windows 10" },
    network: null,
    location: { latitude: "3.42", longitude: "-76.52" },
    externalValidations: {
      accuant_validation: { validation_result: true, valid_acceptance_criteria: 27 },
    },
    alerts: [],
    raw: { createResponse: null, stepResponse: null, dataResponse: null },
  };

  await prisma.validationExecution.upsert({
    where: { id: demoExecutionId },
    update: {},
    create: {
      id: demoExecutionId,
      validationId: "demo-0000-0000-0000-000000000001",
      processName: "Onboarding DEMO #1",
      environmentId: environment.id,
      templateId: basicTemplate.id,
      requestPayload: JSON.stringify(demoRequestPayload),
      responsePayload: JSON.stringify({ success: true, error: null, code: 0, data: { key: "***", vector: "***", validationId: "demo-0000-0000-0000-000000000001" } }),
      normalizedResponse: JSON.stringify(demoNormalized),
      rawStatus: "TERMINADO",
      normalizedStatus: "COMPLETED",
      result: "APPROVED",
      clientNameMasked: "N*** DEMO",
      clientEmailMasked: "c***@ejemplo.com",
      isDemo: true,
      startedAt: new Date("2026-01-01T10:00:00.000Z"),
      completedAt: new Date("2026-01-01T10:06:00.000Z"),
      lastSyncedAt: new Date("2026-01-01T10:06:00.000Z"),
      createdById: admin.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "CREATE",
      entityType: "ValidationExecution",
      entityId: demoExecutionId,
      metadata: JSON.stringify({ note: "Registro de auditoría de demostración (seed)" }),
    },
  });

  console.log("");
  console.log("Semillas creadas correctamente.");
  console.log("Usuarios de demostración (cambie la contraseña en un entorno real):");
  console.log("  admin@demo.local / operador@demo.local / auditor@demo.local");
  console.log(`  contraseña: ${DEMO_PASSWORD}`);
  console.log("");
}

main()
  .catch((error) => {
    console.error("Error ejecutando el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
