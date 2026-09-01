/**
 * Cache de tokens OAuth de FAD, exclusivamente en memoria del proceso backend, por ambiente.
 * Nunca se persiste ni se envía al frontend (ver docs/security-decisions.md).
 */
interface CachedToken {
  accessToken: string;
  tokenType: string;
  expiresAt: number; // epoch ms
}

const cache = new Map<string, CachedToken>();

export function getCachedToken(environmentId: string, refreshMarginSeconds: number): CachedToken | null {
  const entry = cache.get(environmentId);
  if (!entry) return null;
  const marginMs = refreshMarginSeconds * 1000;
  if (Date.now() >= entry.expiresAt - marginMs) {
    return null;
  }
  return entry;
}

export function setCachedToken(
  environmentId: string,
  accessToken: string,
  tokenType: string,
  expiresInSeconds: number,
): void {
  cache.set(environmentId, {
    accessToken,
    tokenType,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });
}

export function clearCachedToken(environmentId: string): void {
  cache.delete(environmentId);
}
