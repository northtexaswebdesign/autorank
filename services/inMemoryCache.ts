/**
 * Senior Engineer Note: Using a Map for O(1) lookups.
 * This cache is volatile and exists only within the heap of the current JS execution context.
 */
class InMemoryCache {
    private cache = new Map<string, any>();

    set(key: string, value: any): void {
        this.cache.set(key, value);
    }

    get<T>(key: string): T | null {
        return this.cache.get(key) || null;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }
}

export const sessionCache = new InMemoryCache();