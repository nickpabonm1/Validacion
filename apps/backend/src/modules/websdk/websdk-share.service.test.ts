import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import {
  createShareLink,
  getExternalValidationStatus,
  getPublicShareInfo,
  markShareLinkCompleted,
  markShareLinkStarted,
  resolveExecutionId,
  resolveStartInput,
} from "./websdk-share.service";

async function setupEnvironmentAndUser() {
  await prisma.webSdkShareLink.deleteMany();
  await prisma.validationExecution.deleteMany();
  await prisma.webSdkConfig.deleteMany();
  await prisma.apiEnvironment.deleteMany();
  await prisma.user.deleteMany({ where: { email: "share-test@demo.local" } });

  const environment = await prisma.apiEnvironment.create({
    data: { name: "Env de prueba enlaces", environmentType: "UATHA", baseUrl: "https://fad.test.invalid", integrationModel: "WEB_SDK" },
  });
  await prisma.webSdkConfig.create({ data: { environmentId: environment.id } });
  const user = await prisma.user.create({
    data: { name: "Operador Test", email: "share-test@demo.local", passwordHash: await bcrypt.hash("x", 4), role: "OPERATOR" },
  });

  return { environmentId: environment.id, userId: user.id };
}

describe("websdk-share.service: enlaces de captura compartibles", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("crea un enlace PENDING con token/expiración y expone la info pública mínima", async () => {
    const { environmentId, userId } = await setupEnvironmentAndUser();
    const { link, environmentName } = await createShareLink(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      userId,
    );
    expect(link.status).toBe("PENDING");
    expect(link.token).toHaveLength(43); // randomBytes(32).toString("base64url")
    expect(environmentName).toBe("Env de prueba enlaces");
    expect(link.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const info = await getPublicShareInfo(link.token);
    expect(info.status).toBe("PENDING");
    expect(info.clientName).toBe("Cliente Demo");
    expect(info.onboardingMessages.welcomeTitle).toBeTruthy();
  });

  it("usa 30 minutos de vigencia por defecto, pero acepta una vigencia personalizada (expiresInMinutes)", async () => {
    const { environmentId, userId } = await setupEnvironmentAndUser();

    const before = Date.now();
    const { link: defaultLink } = await createShareLink(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      userId,
    );
    const defaultTtlMinutes = (defaultLink.expiresAt.getTime() - before) / 60000;
    expect(defaultTtlMinutes).toBeGreaterThan(29);
    expect(defaultTtlMinutes).toBeLessThanOrEqual(30.1);

    const { link: customLink } = await createShareLink(
      {
        environmentId,
        expiresInMinutes: 60 * 24 * 7, // 7 días
        client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" },
      },
      userId,
    );
    const customTtlMinutes = (customLink.expiresAt.getTime() - before) / 60000;
    expect(customTtlMinutes).toBeGreaterThan(60 * 24 * 7 - 1);
    expect(customTtlMinutes).toBeLessThanOrEqual(60 * 24 * 7 + 0.1);
  });

  it("resolveStartInput no trae executionId hasta que se marca STARTED", async () => {
    const { environmentId, userId } = await setupEnvironmentAndUser();
    const { link } = await createShareLink(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      userId,
    );

    const before = await resolveStartInput(link.token);
    expect(before.existingExecutionId).toBeNull();

    const fakeExecution = await prisma.validationExecution.create({
      data: {
        processName: "Test",
        environmentId,
        requestPayload: "{}",
        normalizedStatus: "IN_PROGRESS",
        clientNameMasked: "C***",
        clientEmailMasked: "c***@ejemplo.com",
      },
    });
    await markShareLinkStarted(link.token, fakeExecution.id);

    const after = await resolveStartInput(link.token);
    expect(after.existingExecutionId).toBe(fakeExecution.id);
    expect(await resolveExecutionId(link.token)).toBe(fakeExecution.id);
  });

  it("rechaza operar sobre un enlace ya COMPLETED", async () => {
    const { environmentId, userId } = await setupEnvironmentAndUser();
    const { link } = await createShareLink(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      userId,
    );
    await markShareLinkCompleted(link.token);

    await expect(getPublicShareInfo(link.token)).rejects.toThrow(/ya se usó/i);
  });

  it("rechaza un enlace expirado y un token inexistente", async () => {
    const { environmentId, userId } = await setupEnvironmentAndUser();
    const { link } = await createShareLink(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      userId,
    );
    await prisma.webSdkShareLink.update({ where: { token: link.token }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(getPublicShareInfo(link.token)).rejects.toThrow(/expiró/i);
    await expect(getPublicShareInfo("token-que-no-existe")).rejects.toThrow(/no encontrado/i);
  });

  it("crea un enlace con createdById null (sistema externo) y getExternalValidationStatus refleja el estado real de la ejecución", async () => {
    const { environmentId } = await setupEnvironmentAndUser();
    const { link } = await createShareLink(
      { environmentId, client: { name: "Cliente Externo", mail: "externo@ejemplo.com", phone: "+573000000000" } },
      null,
    );
    expect(link.createdById).toBeNull();

    const before = await getExternalValidationStatus(link.id, environmentId);
    expect(before).toMatchObject({ status: "PENDING", executionId: null, normalizedStatus: null, result: null, detail: null });

    // Igual que en el flujo real (ver `completeWebSdkExecution` en websdk-flow.service.ts):
    // `normalizedResponse` queda `null` mientras el usuario todavía está capturando, y solo se
    // puebla de una sola vez cuando la ejecución termina.
    const fakeExecution = await prisma.validationExecution.create({
      data: {
        processName: "Test",
        environmentId,
        requestPayload: "{}",
        normalizedStatus: "IN_PROGRESS",
        clientNameMasked: "C***",
        clientEmailMasked: "c***@ejemplo.com",
      },
    });
    await markShareLinkStarted(link.token, fakeExecution.id);

    const midFlight = await getExternalValidationStatus(link.id, environmentId);
    expect(midFlight).toMatchObject({ status: "STARTED", executionId: fakeExecution.id, detail: null });

    const fakeDetail = { validationId: "demo-id", ocr: { fullName: "Cliente Externo" }, documentChecks: [] };
    await prisma.validationExecution.update({
      where: { id: fakeExecution.id },
      data: { normalizedStatus: "COMPLETED", result: "APPROVED", normalizedResponse: JSON.stringify(fakeDetail) },
    });
    await markShareLinkCompleted(link.token);

    const after = await getExternalValidationStatus(link.id, environmentId);
    expect(after).toMatchObject({
      status: "COMPLETED",
      executionId: fakeExecution.id,
      normalizedStatus: "COMPLETED",
      result: "APPROVED",
      detail: fakeDetail,
    });
  });

  it("getExternalValidationStatus rechaza consultar un enlace que pertenece a otro ambiente", async () => {
    const { environmentId, userId } = await setupEnvironmentAndUser();
    const { link } = await createShareLink(
      { environmentId, client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" } },
      userId,
    );
    const otherEnvironment = await prisma.apiEnvironment.create({
      data: { name: "Otro ambiente", environmentType: "UATHA", baseUrl: "https://otro.test.invalid", integrationModel: "WEB_SDK" },
    });

    await expect(getExternalValidationStatus(link.id, otherEnvironment.id)).rejects.toThrow(/no encontrada/i);
  });

  it("rechaza crear un enlace sobre un ambiente que no es Web SDK", async () => {
    const { userId } = await setupEnvironmentAndUser();
    const apiBySteps = await prisma.apiEnvironment.create({
      data: { name: "Env API-by-steps", environmentType: "UATHA", baseUrl: "https://x.test", integrationModel: "API_BY_STEPS" },
    });
    await expect(
      createShareLink(
        { environmentId: apiBySteps.id, client: { name: "Cliente", mail: "c@x.com", phone: "+573000000000" } },
        userId,
      ),
    ).rejects.toThrow(/Web SDK/i);
  });
});
