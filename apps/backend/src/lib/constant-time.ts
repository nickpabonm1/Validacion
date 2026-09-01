import { timingSafeEqual } from "node:crypto";

/** Compara dos strings en tiempo constante (independiente de su longitud) para evitar fugas
 * de información por temporización, usado en la autenticación Basic de webhooks entrantes. */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  const maxLength = Math.max(bufferA.length, bufferB.length, 1);
  const paddedA = Buffer.alloc(maxLength);
  const paddedB = Buffer.alloc(maxLength);
  bufferA.copy(paddedA);
  bufferB.copy(paddedB);
  const equalContent = timingSafeEqual(paddedA, paddedB);
  return equalContent && bufferA.length === bufferB.length;
}
