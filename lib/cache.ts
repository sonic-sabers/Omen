const store = new Map<string, { value: unknown; expiresAt: number }>();
const activeRuns = new Set<string>();

export function getCache<T>(key: string): T | undefined {
  const item = store.get(key);
  if (!item) return undefined;
  if (Date.now() > item.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return item.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function acquireRunLock(sessionId: string): boolean {
  if (activeRuns.has(sessionId)) return false;
  activeRuns.add(sessionId);
  return true;
}

export function releaseRunLock(sessionId: string) {
  activeRuns.delete(sessionId);
}
