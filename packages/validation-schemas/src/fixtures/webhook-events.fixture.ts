/** Fixtures sanitizados de eventos de webhook (Webhooks Service Definition v1.3). */
export const createdValidationStepWebhookFixture = {
  id: "00000000-0000-4000-8000-000000000010",
  idUser: "00000000-0000-4000-8000-000000000099",
  event: "CREATED_VALIDATION_STEP",
  creationDate: "01/01/2026 10:00:00",
  data: {
    key: "DEMOKEY0000000",
    vector: "DEMOVECTOR00000",
    validationId: "00000000-0000-4000-8000-000000000001",
  },
  retry: 0,
  error: "",
  idOriginal: null,
};

export const resultValidationStepWebhookFixture = {
  id: "00000000-0000-4000-8000-000000000011",
  idUser: "00000000-0000-4000-8000-000000000099",
  event: "RESULT_VALIDATION_STEP",
  creationDate: "01/01/2026 10:02:00",
  data: {
    success: true,
    error: null,
    code: 0,
    data: {
      validation_result: true,
      skipped_acceptance_criteria: 0,
      invalid_acceptance_criteria: 7,
      valid_acceptance_criteria: 19,
    },
  },
  retry: 0,
  error: "",
  idOriginal: null,
};

export const completedValidationStepWebhookFixture = {
  id: "00000000-0000-4000-8000-000000000012",
  idUser: "00000000-0000-4000-8000-000000000099",
  event: "COMPLETED_VALIDATION_STEP",
  creationDate: "01/01/2026 10:05:00",
  data: {
    validationName: "Onboarding demo",
    endDate: "2026-01-01T10:05:00",
    validationId: "00000000-0000-4000-8000-000000000001",
  },
  retry: 0,
  error: "",
  idOriginal: null,
};

export const completedValidationWebhookFixture = {
  id: "00000000-0000-4000-8000-000000000013",
  idUser: "00000000-0000-4000-8000-000000000099",
  event: "COMPLETED_VALIDATION",
  creationDate: "01/01/2026 10:06:00",
  data: {
    validationName: "Onboarding demo",
    startDate: "2026-01-01T10:00:00",
    endDate: "2026-01-01T10:06:00",
    validationId: "00000000-0000-4000-8000-000000000001",
    result: { success: true, error: null, code: null, data: { status: "TERMINADO" } },
  },
  retry: 0,
  error: "",
  idOriginal: null,
};

export const validationChangeStatusWebhookFixture = {
  id: "00000000-0000-4000-8000-000000000014",
  idUser: "00000000-0000-4000-8000-000000000099",
  event: "VALIDATION_CHANGE_STATUS",
  creationDate: "01/01/2026 10:06:30",
  data: {
    validationId: "00000000-0000-4000-8000-000000000001",
    result: "Aprobado",
    status: "Terminado",
  },
  retry: 0,
  error: "",
  idOriginal: null,
};

export const unknownWebhookFixture = {
  id: "00000000-0000-4000-8000-000000000015",
  idUser: "00000000-0000-4000-8000-000000000099",
  event: "SOME_FUTURE_EVENT_NOT_YET_DOCUMENTED",
  creationDate: "01/01/2026 10:07:00",
  data: { anything: "goes here" },
  retry: 0,
  error: "",
  idOriginal: null,
};
