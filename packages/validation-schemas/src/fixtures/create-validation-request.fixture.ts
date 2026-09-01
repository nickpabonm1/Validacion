/**
 * Fixture sanitizado, derivado de la estructura real observada en la colección Postman
 * `createValidation Autentic AF` (ambiente UATHA). Todos los datos de cliente son ficticios;
 * no se reutilizó ningún dato personal ni credencial de la colección original.
 */
export const createValidationRequestFixture = {
  processName: "Onboarding demo",
  validity: 5,
  client: {
    name: "Cliente de Prueba",
    mail: "cliente.demo@example.com",
    phone: "+573000000000",
  },
  steps: {
    location: { order: 1, show: true, configuration: {}, features: {} },
    captureId: {
      order: 2,
      show: true,
      configuration: {},
      features: { provider: 2 },
    },
    formValidationId: {
      order: 3,
      show: true,
      configuration: {},
      features: {},
      input: {
        forms: [
          {
            classification: {
              cardType: 4,
              countryCode: "COL",
              cardTypeDescription: "Identification Card",
            },
            fields: [
              {
                id: "documentNumber",
                inputType: "number",
                label: "Número de documento",
                required: true,
                replaceValue: true,
                value: "Document Number",
                order: 0,
                visible: true,
              },
              {
                id: "givenName",
                inputType: "text",
                label: "Nombre(s)",
                required: true,
                replaceValue: true,
                value: "Given Name",
                order: 1,
                visible: true,
              },
            ],
          },
        ],
      },
    },
    liveness: {
      order: 4,
      show: false,
      configuration: {},
      features: { provider: 1 },
    },
  },
  customization: {
    theme: [
      { key: "--fad-common-primary-color", value: "#005b95" },
      { key: "--fad-common-secondary-color", value: "#00b5e1" },
    ],
    header: [{ type: "IMG" as const, content: "https://example.com/demo-logo.png" }],
  },
  feature: {
    redirect: { url: "https://example.com/gracias" },
  },
  notifications: { email: false, whatsapp: false },
};
