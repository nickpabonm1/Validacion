import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OcrTable } from "./OcrTable";
import { ToastProvider } from "../ui/toast";

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("OcrTable", () => {
  it("nunca vuelca una cadena larga (probable base64 no extraído) como texto crudo", () => {
    const longValue = "a".repeat(500);
    renderWithToast(<OcrTable data={{ documentNumber: "0000000000", photo: longValue }} />);
    expect(screen.getByText("0000000000")).toBeInTheDocument();
    expect(screen.queryByText(longValue)).not.toBeInTheDocument();
    expect(screen.getByText(/contenido binario/i)).toBeInTheDocument();
  });

  it("muestra cadenas cortas y números normalmente", () => {
    renderWithToast(<OcrTable data={{ fullName: "CLIENTE DEMO", score: 97.5 }} />);
    expect(screen.getByText("CLIENTE DEMO")).toBeInTheDocument();
    expect(screen.getByText("97.5")).toBeInTheDocument();
  });

  it("omite campos null/undefined/vacíos: muestra el estado sin coincidencias si todos lo son", () => {
    renderWithToast(<OcrTable data={{ a: null, b: undefined, c: "" }} />);
    expect(screen.getByText(/sin coincidencias/i)).toBeInTheDocument();
  });

  it("no renderiza nada cuando el objeto de datos está vacío", () => {
    const { container } = renderWithToast(<OcrTable data={{}} />);
    expect(container.querySelector("table")).toBeNull();
  });
});
