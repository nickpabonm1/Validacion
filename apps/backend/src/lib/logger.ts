import { redact } from "./redact";

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.log(`[${timestamp()}] INFO  ${message}`, meta !== undefined ? redact(meta) : "");
  },
  warn(message: string, meta?: unknown): void {
    console.warn(`[${timestamp()}] WARN  ${message}`, meta !== undefined ? redact(meta) : "");
  },
  error(message: string, meta?: unknown): void {
    console.error(`[${timestamp()}] ERROR ${message}`, meta !== undefined ? redact(meta) : "");
  },
};
