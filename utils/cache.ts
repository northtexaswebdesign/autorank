import { AppStateCache } from '../types.ts';

const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface CachedData {
    timestamp: number;
    state: AppStateCache;
}

export const saveStateToCache = (key: string, state: AppStateCache): void => {
    try {
        const dataToCache: CachedData = {
            timestamp: Date.now(),
            state: state,
        };
        localStorage.setItem(key, JSON.stringify(dataToCache));
    } catch (e) {
        console.error("Failed to save state to localStorage, storage might be full.", e);
    }
};

export const loadStateFromCache = (key: string): AppStateCache | null => {
    try {
        const cachedItem = localStorage.getItem(key);
        if (!cachedItem) return null;

        const cachedData: CachedData = JSON.parse(cachedItem);
        const isCacheStale = Date.now() - cachedData.timestamp > CACHE_DURATION_MS;
        
        if (isCacheStale) {
            localStorage.removeItem(key); // Clean up stale cache
            return null;
        }

        return cachedData.state;
    } catch (e) {
        console.error("Failed to load or parse state from localStorage.", e);
        // Clear corrupted cache item
        localStorage.removeItem(key);
        return null;
    }
};
