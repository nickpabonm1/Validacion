import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_BODY_TEMPLATE, DEFAULT_EMAIL_SUBJECT_TEMPLATE, htmlToPlainText, renderEmailTemplate } from "./email-template";

const baseVars = {
  processName: "Onboarding cliente",
  environmentName: "UATHA",
  clientName: "Cliente Demo",
  link: "https://demo.example.invalid/v/abc123",
  logoDataUrl: null,
};

describe("renderEmailTemplate", () => {
  it("sustituye todos los placeholders conocidos", () => {
    const rendered = renderEmailTemplate(
      "Hola {{clientName}}, tu proceso {{processName}} en {{environmentName}}: {{link}}",
      baseVars,
    );
    expect(rendered).toBe("Hola Cliente Demo, tu proceso Onboarding cliente en UATHA: https://demo.example.invalid/v/abc123");
  });

  it("escapa el HTML de los valores sustituidos, para no inyectar HTML ajeno en la plantilla del administrador", () => {
    const rendered = renderEmailTemplate("{{processName}}", { ...baseVars, processName: '<script>alert(1)</script>' });
    expect(rendered).not.toContain("<script>");
    expect(rendered).toContain("&lt;script&gt;");
  });

  it("{{logo}} inserta una etiqueta img cuando el cliente tiene logo, y nada cuando no", () => {
    const withLogo = renderEmailTemplate("{{logo}}", { ...baseVars, logoDataUrl: "data:image/png;base64,AAA" });
    expect(withLogo).toContain('<img src="data:image/png;base64,AAA"');

    const withoutLogo = renderEmailTemplate("antes{{logo}}despues", baseVars);
    expect(withoutLogo).toBe("antesdespues");
  });

  it("la plantilla por defecto se renderiza sin dejar placeholders sin sustituir", () => {
    const subject = renderEmailTemplate(DEFAULT_EMAIL_SUBJECT_TEMPLATE, baseVars);
    const body = renderEmailTemplate(DEFAULT_EMAIL_BODY_TEMPLATE, baseVars);
    expect(subject).not.toMatch(/\{\{/);
    expect(body).not.toMatch(/\{\{/);
    expect(body).toContain(baseVars.link);
  });
});

describe("htmlToPlainText", () => {
  it("convierte enlaces, párrafos y entidades a texto plano legible", () => {
    const html = '<p>Hola <strong>mundo</strong></p><p><a href="https://x.test">Abrir</a></p>';
    const text = htmlToPlainText(html);
    expect(text).toContain("Hola mundo");
    expect(text).toContain("Abrir: https://x.test");
    expect(text).not.toContain("<");
  });
});
