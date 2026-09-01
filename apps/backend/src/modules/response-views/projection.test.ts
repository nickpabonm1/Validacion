import { describe, expect, it } from "vitest";
import { projectResponseView } from "./projection";

const detail = {
  status: "COMPLETED",
  result: "APPROVED",
  client: { nameMasked: "E*** H******", email: "secret@example.com" },
  comparisonPercentage: 99.5,
  completedAt: null,
  raw: { createResponse: { data: { key: "real-secret-key" } } },
};

describe("projectResponseView (motor de proyección seguro, sin eval)", () => {
  it("resuelve rutas anidadas y respeta el orden configurado", () => {
    const fields = projectResponseView(
      detail,
      {
        fields: [
          { id: "a", path: "status", label: "Estado", group: "g", order: 1, visible: true, showOnlyIfHasValue: false, renderType: "STATUS", sensitivity: "INTERNAL" },
          { id: "b", path: "client.nameMasked", label: "Cliente", group: "g", order: 0, visible: true, showOnlyIfHasValue: false, renderType: "TEXT", sensitivity: "SENSITIVE" },
        ],
      },
      "OPERATOR",
    );
    expect(fields.map((f) => f.id)).toEqual(["b", "a"]);
    expect(fields[0]!.value).toBe("E*** H******");
  });

  it("omite campos con showOnlyIfHasValue cuando el valor está vacío", () => {
    const fields = projectResponseView(
      detail,
      {
        fields: [
          { id: "c", path: "completedAt", label: "Fin", group: "g", order: 0, visible: true, showOnlyIfHasValue: true, renderType: "DATETIME", sensitivity: "INTERNAL" },
        ],
      },
      "OPERATOR",
    );
    expect(fields).toHaveLength(0);
  });

  it("omite campos con permiso requerido para roles que no coinciden (ADMIN ve todo)", () => {
    const config = {
      fields: [
        { id: "d", path: "status", label: "Estado", group: "g", order: 0, visible: true, showOnlyIfHasValue: false, renderType: "STATUS", sensitivity: "INTERNAL", requiredRole: "ADMIN" as const },
      ],
    };
    expect(projectResponseView(detail, config, "AUDITOR")).toHaveLength(0);
    expect(projectResponseView(detail, config, "ADMIN")).toHaveLength(1);
  });

  it("enmascara siempre los campos de sensibilidad SECRET, sin importar el renderType configurado", () => {
    const fields = projectResponseView(
      detail,
      {
        fields: [
          { id: "e", path: "raw.createResponse.data.key", label: "Key", group: "g", order: 0, visible: true, showOnlyIfHasValue: false, renderType: "TEXT", sensitivity: "SECRET" },
        ],
      },
      "ADMIN",
    );
    expect(fields[0]!.masked).toBe(true);
    expect(fields[0]!.value).not.toBe("real-secret-key");
  });

  it("evalúa condiciones sin usar eval", () => {
    const config = {
      fields: [
        {
          id: "f",
          path: "comparisonPercentage",
          label: "% comparación",
          group: "g",
          order: 0,
          visible: true,
          showOnlyIfHasValue: false,
          renderType: "PERCENTAGE" as const,
          sensitivity: "INTERNAL" as const,
          condition: { path: "status", operator: "eq" as const, value: "COMPLETED" },
        },
      ],
    };
    expect(projectResponseView(detail, config, "OPERATOR")).toHaveLength(1);
    expect(
      projectResponseView({ ...detail, status: "IN_PROGRESS" }, config, "OPERATOR"),
    ).toHaveLength(0);
  });
});
