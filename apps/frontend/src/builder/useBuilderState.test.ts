import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBuilderState } from "./useBuilderState";

describe("useBuilderState (estado del Constructor de validación)", () => {
  it("agrega pasos con orden consecutivo y no permite duplicados", () => {
    const { result } = renderHook(() => useBuilderState());

    act(() => result.current.addStep("location"));
    act(() => result.current.addStep("captureId"));
    act(() => result.current.addStep("location")); // duplicado: no debe agregarse de nuevo

    expect(Object.keys(result.current.config.steps)).toEqual(["location", "captureId"]);
    expect(result.current.config.steps.location?.order).toBe(1);
    expect(result.current.config.steps.captureId?.order).toBe(2);
  });

  it("renumera automáticamente el orden al eliminar un paso intermedio", () => {
    const { result } = renderHook(() => useBuilderState());
    act(() => {
      result.current.addStep("location");
      result.current.addStep("privacyNotice");
      result.current.addStep("captureId");
    });

    act(() => result.current.removeStep("privacyNotice"));

    expect(Object.keys(result.current.config.steps)).toEqual(["location", "captureId"]);
    expect(result.current.config.steps.captureId?.order).toBe(2);
  });

  it("reordena los pasos y renumera secuencialmente", () => {
    const { result } = renderHook(() => useBuilderState());
    act(() => {
      result.current.addStep("location");
      result.current.addStep("privacyNotice");
      result.current.addStep("captureId");
    });

    act(() => result.current.reorderSteps(["captureId", "location", "privacyNotice"]));

    expect(result.current.orderedStepKeys).toEqual(["captureId", "location", "privacyNotice"]);
    expect(result.current.config.steps.captureId?.order).toBe(1);
    expect(result.current.config.steps.location?.order).toBe(2);
    expect(result.current.config.steps.privacyNotice?.order).toBe(3);
  });

  it("alterna show sin afectar el orden", () => {
    const { result } = renderHook(() => useBuilderState());
    act(() => result.current.addStep("location"));

    expect(result.current.config.steps.location?.show).toBe(true);
    act(() => result.current.toggleShow("location"));
    expect(result.current.config.steps.location?.show).toBe(false);
    expect(result.current.config.steps.location?.order).toBe(1);
  });

  it("restaura un paso a sus valores por defecto conservando su orden", () => {
    const { result } = renderHook(() => useBuilderState());
    act(() => result.current.addStep("captureId"));
    act(() => result.current.updateStep("captureId", { features: { provider: 99 } }));
    expect(result.current.config.steps.captureId?.features?.provider).toBe(99);

    act(() => result.current.resetStep("captureId"));
    expect(result.current.config.steps.captureId?.features?.provider).toBe(1);
    expect(result.current.config.steps.captureId?.order).toBe(1);
  });
});
