export interface ParsedDate {
  iso: string | null;
  raw: string | number | null;
}

const DMY_HMS = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/; // DD/MM/YYYY HH:mm:ss
const YMD_HM = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/; // YYYY-MM-DD HH:mm[:ss]

/**
 * Parsea fechas en cualquiera de los formatos observados en la documentación fuente (sección
 * 24 del brief / inconsistencia de formatos): `DD/MM/YYYY HH:mm:ss` (webhooks), ISO 8601,
 * `YYYY-MM-DD HH:mm` (getValidationData) y timestamps numéricos (epoch en ms o s). Nunca lanza:
 * si no reconoce el formato devuelve `iso: null` preservando siempre el valor original en `raw`.
 */
export function parseFlexibleDate(input: string | number | null | undefined): ParsedDate {
  if (input === null || input === undefined || input === "") {
    return { iso: null, raw: input ?? null };
  }

  if (typeof input === "number") {
    const ms = input < 10_000_000_000 ? input * 1000 : input;
    const date = new Date(ms);
    return { iso: Number.isNaN(date.getTime()) ? null : date.toISOString(), raw: input };
  }

  const trimmed = input.trim();

  const dmy = DMY_HMS.exec(trimmed);
  if (dmy) {
    const [, day, month, year, hour, minute, second] = dmy;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)),
    );
    return { iso: Number.isNaN(date.getTime()) ? null : date.toISOString(), raw: input };
  }

  const ymd = YMD_HM.exec(trimmed);
  if (ymd) {
    const [, year, month, day, hour, minute, second] = ymd;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0)),
    );
    return { iso: Number.isNaN(date.getTime()) ? null : date.toISOString(), raw: input };
  }

  const isoAttempt = new Date(trimmed);
  if (!Number.isNaN(isoAttempt.getTime())) {
    return { iso: isoAttempt.toISOString(), raw: input };
  }

  return { iso: null, raw: input };
}
