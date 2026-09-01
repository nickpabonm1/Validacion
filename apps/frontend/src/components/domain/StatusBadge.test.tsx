import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, ResultBadge } from "./StatusBadge";

describe("StatusBadge / ResultBadge", () => {
  it("traduce estados normalizados conocidos", () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText("Completada")).toBeInTheDocument();
  });

  it("cae a UNKNOWN de forma segura ante un estado no reconocido", () => {
    render(<StatusBadge status="ALGO_NO_DOCUMENTADO" />);
    expect(screen.getByText("ALGO_NO_DOCUMENTADO")).toBeInTheDocument();
  });

  it("muestra un resultado neutro cuando no hay resultado", () => {
    render(<ResultBadge result={null} />);
    expect(screen.getByText("Sin resultado")).toBeInTheDocument();
  });

  it("traduce Aprobado/Rechazado", () => {
    render(<ResultBadge result="APPROVED" />);
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
  });
});
