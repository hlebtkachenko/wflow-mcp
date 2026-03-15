const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class ResponseCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private ttlMs: number;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get enabled(): boolean {
    return this.ttlMs > 0;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    if (!this.enabled) return;
    if (this.store.size >= MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key);
    }
  }
}
