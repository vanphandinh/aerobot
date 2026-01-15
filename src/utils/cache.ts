/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T> {
    private data: Map<string, { value: T; expiry: number }> = new Map();
    private ttl: number;

    constructor(ttlMs: number) {
        this.ttl = ttlMs;
    }

    get(key: string): T | undefined {
        const entry = this.data.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiry) {
            this.data.delete(key);
            return undefined;
        }

        return entry.value;
    }

    set(key: string, value: T): void {
        this.data.set(key, {
            value,
            expiry: Date.now() + this.ttl,
        });
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    clear(): void {
        this.data.clear();
    }

    // Clean up expired entries
    prune(): void {
        const now = Date.now();
        for (const [key, entry] of this.data.entries()) {
            if (now > entry.expiry) {
                this.data.delete(key);
            }
        }
    }
}
