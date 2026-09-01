import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getCachedToken, setCachedToken, clearCachedToken } from "./token-cache";

describe("token-cache (renovación anticipada del token OAuth)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve null cuando no hay token cacheado", () => {
    expect(getCachedToken("env-a", 60)).toBeNull();
  });

  it("devuelve el token mientras no esté cerca de expirar", () => {
    setCachedToken("env-b", "tok-123", "bearer", 3600);
    const cached = getCachedToken("env-b", 60);
    expect(cached?.accessToken).toBe("tok-123");
  });

  it("expira el token anticipadamente respetando el margen de renovación", () => {
    setCachedToken("env-c", "tok-456", "bearer", 100);
    vi.advanceTimersByTime(50_000); // quedan 50s de vida, margen de 60s
    expect(getCachedToken("env-c", 60)).toBeNull();
  });

  it("sigue siendo válido justo antes de entrar en el margen de renovación", () => {
    setCachedToken("env-d", "tok-789", "bearer", 100);
    vi.advanceTimersByTime(30_000); // quedan 70s de vida, margen de 60s
    expect(getCachedToken("env-d", 60)?.accessToken).toBe("tok-789");
  });

  it("clearCachedToken elimina el token cacheado", () => {
    setCachedToken("env-e", "tok-000", "bearer", 3600);
    clearCachedToken("env-e");
    expect(getCachedToken("env-e", 60)).toBeNull();
  });
});
