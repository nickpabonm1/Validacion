/** Enmascara PII para vistas por defecto (sección 21 del brief). */
export function maskName(name: string | null | undefined): string {
  if (!name) return "—";
  return name
    .trim()
    .split(/\s+/)
    .map((word) => (word.length <= 1 ? word : `${word[0]}${"*".repeat(Math.max(word.length - 1, 3))}`))
    .join(" ");
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "—";
  const [local, domain] = email.split("@");
  const visible = (local ?? "").slice(0, 1) || "*";
  return `${visible}${"*".repeat(Math.max((local ?? "").length - 1, 3))}@${domain}`;
}

export function maskGeneric(value: string | null | undefined, visibleChars = 4): string {
  if (!value) return "—";
  if (value.length <= visibleChars) return "*".repeat(value.length);
  return `${"*".repeat(value.length - visibleChars)}${value.slice(-visibleChars)}`;
}
