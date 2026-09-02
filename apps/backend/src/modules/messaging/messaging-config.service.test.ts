import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { decryptMessagingCredentials, getMessagingConfig, toMessagingConfigDto, upsertMessagingConfig } from "./messaging-config.service";

describe("messaging-config.service: configuración global de mensajería", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("crea la fila singleton con valores por defecto en el primer acceso", async () => {
    await prisma.messagingConfig.deleteMany();
    const config = await getMessagingConfig();
    expect(config.id).toBe("singleton");
    expect(config.smtpHost).toBeNull();
    expect(config.whatsappApiBaseUrl).toBe("https://graph.facebook.com/v20.0");

    const dto = toMessagingConfigDto(config);
    expect(dto.smtpUserConfigured).toBe(false);
    expect(dto.whatsappAccessTokenConfigured).toBe(false);
  });

  it("cifra las credenciales al guardar y las descifra correctamente para uso interno", async () => {
    await prisma.messagingConfig.deleteMany();
    await upsertMessagingConfig({
      smtpHost: "smtp.test.invalid",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "smtp-user",
      smtpPassword: "smtp-pass",
      fromAddress: "no-reply@test.invalid",
      fromName: "Test Console",
      whatsappApiBaseUrl: "https://graph.facebook.com/v20.0",
      whatsappPhoneNumberId: "1234567890",
      whatsappAccessToken: "wa-token",
      whatsappTemplateName: "onboarding_link",
      whatsappTemplateLanguage: "es",
    });

    const config = await getMessagingConfig();
    expect(config.smtpUserEnc).not.toBe("smtp-user"); // nunca texto plano
    expect(config.whatsappAccessTokenEnc).not.toBe("wa-token");

    const dto = toMessagingConfigDto(config);
    expect(dto.smtpUserConfigured).toBe(true);
    expect(dto.whatsappAccessTokenConfigured).toBe(true);
    expect(dto.smtpHost).toBe("smtp.test.invalid");

    const creds = decryptMessagingCredentials(config);
    expect(creds.smtpUser).toBe("smtp-user");
    expect(creds.smtpPassword).toBe("smtp-pass");
    expect(creds.whatsappAccessToken).toBe("wa-token");
  });

  it("dejar un campo de credencial vacío en una edición conserva el valor existente", async () => {
    await prisma.messagingConfig.deleteMany();
    await upsertMessagingConfig({
      smtpHost: "smtp.test.invalid",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "smtp-user",
      smtpPassword: "smtp-pass",
      fromName: "Test Console",
      whatsappApiBaseUrl: "https://graph.facebook.com/v20.0",
      whatsappTemplateLanguage: "es",
    });

    // Segunda edición sin `smtpUser`/`smtpPassword`: no deben borrarse.
    await upsertMessagingConfig({
      smtpHost: "smtp.test.invalid",
      smtpPort: 2525,
      smtpSecure: true,
      fromName: "Test Console",
      whatsappApiBaseUrl: "https://graph.facebook.com/v20.0",
      whatsappTemplateLanguage: "es",
    });

    const config = await getMessagingConfig();
    expect(config.smtpPort).toBe(2525);
    expect(config.smtpSecure).toBe(true);
    const creds = decryptMessagingCredentials(config);
    expect(creds.smtpUser).toBe("smtp-user");
    expect(creds.smtpPassword).toBe("smtp-pass");
  });
});
