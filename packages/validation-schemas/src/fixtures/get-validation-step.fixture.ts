/** Fixture sanitizado derivado del ejemplo de la sección 2.4 del PDF. Datos ficticios. */
export const getValidationStepResponseFixture = {
  success: true,
  error: null,
  code: null,
  data: {
    processName: "Validation Step",
    validation: {
      idProcess: "00000000-0000-4000-8000-000000000001",
      status: "EN_PROCESO",
    },
    client: {
      name: "Cliente de Prueba",
      mail: "cliente.demo@example.com",
      phone: "+573000000000",
    },
    steps: {
      location: {
        order: 0,
        status: "PENDING",
        show: true,
        configuration: {},
        features: { alwaysAskLocation: true },
        data: null,
      },
      privacyNotice: {
        order: 1,
        status: "PENDING",
        show: true,
        configuration: {},
        features: {},
        data: null,
      },
      captureId: {
        order: 2,
        status: "COMPLETED",
        show: true,
        configuration: { captureBack: true, captureFront: false },
        features: { provider: 1 },
        data: {
          estatus: 0,
          descripcion: "OK",
          transaccionID: "00000000-0000-4000-8000-000000000002",
        },
      },
      formValidationId: {
        order: 3,
        status: "PENDING",
        show: true,
        configuration: {},
        features: { provider: 1 },
        data: null,
      },
      liveness: {
        order: 4,
        status: "COMPLETED",
        show: true,
        configuration: {},
        features: { provider: 1 },
        data: null,
      },
      fingerprints: {
        order: 5,
        status: "COMPLETED",
        show: true,
        configuration: { fingers: ["L4F", "R4F"] },
        features: {},
        data: null,
      },
    },
    validationKeys: {
      key: "DEMOKEY0000000",
      vector: "DEMOVECTOR00000",
      validationId: "00000000-0000-4000-8000-000000000001",
    },
  },
};
