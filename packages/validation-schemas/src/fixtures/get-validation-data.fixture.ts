/** Fixture sanitizado derivado del ejemplo de la sección 2.5 del PDF. Datos ficticios. */
export const getValidationDataResponseFixture = {
  success: true,
  error: "",
  code: null,
  data: {
    client: {
      clientId: null,
      nombre: "CLIENTE DE PRUEBA DEMO",
      nacionalidad: "colombiana",
    },
    face: {
      mode: "",
      deviceModel: "x64",
    },
    deviceInfo: {
      platform: "Chrome 120.0.0.0",
      deviceModel: "x64",
      operatingSystem: "Windows 10",
      appVersion: "1.0",
    },
    networkInfo: {
      network: null,
      ipAddress: null,
    },
    fingerprints: [],
    pageDetail: [],
    latitude: "3.42",
    longitude: "-76.52",
    companyId: "DEMO",
    status: "TERMINADO",
    startDate: "2026-01-01 10:00",
    userId: "00000000-0000-4000-8000-000000000003",
    idValidation: "00000000-0000-4000-8000-000000000001",
    porcentCompare: 99.5,
    endDate: "2026-01-01 10:05",
    validationWith: "CEDULA_COLOMBIANA",
    statusWith: "EN_BACKEND",
    result: "Aprobado",
    files: [
      {
        fileName: "selfie.png",
        fileUrl: "https://demo.example.com/files/selfie.png",
        fields: {},
      },
      {
        fileName: "documentoAnverso.png",
        fileUrl: "https://demo.example.com/files/documentoAnverso.png",
        fields: {
          documentNumber: "0000000000",
          fullName: "CLIENTE DE PRUEBA DEMO",
          cardType: "cedula_colombiana",
        },
      },
    ],
    imagesComparisonValidation: null,
    relatedProcess: [],
    extraInfo: {},
    externalValidations: {
      accuant_validation: {
        validation_result: true,
        skipped_acceptance_criteria: 0,
        invalid_acceptance_criteria: 1,
        valid_acceptance_criteria: 27,
      },
      comparison_selfie_ine_validation: {
        validation_result: true,
        valid_acceptance_criteria: 70,
        validation_comparison_percentage: 99.5,
      },
    },
    validationProcessResult: "Válido",
  },
};
