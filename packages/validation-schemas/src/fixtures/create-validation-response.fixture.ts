/** Fixture sanitizado (estructura del PDF, sección 2.2). Claves ficticias, no reales. */
export const createValidationResponseFixture = {
  success: true,
  error: null,
  code: 0,
  data: {
    key: "DEMOKEY0000000",
    vector: "DEMOVECTOR00000",
    validationId: "00000000-0000-4000-8000-000000000001",
  },
};

export const createValidationErrorFixture = {
  success: false,
  error: "the step 'test' is not valid",
  code: 500,
  data: null,
};
