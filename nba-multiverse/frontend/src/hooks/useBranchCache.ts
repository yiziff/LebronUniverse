import { useCallback, useEffect, useState } from 'react';
import type { GeneratedEvent } from '../types';

const CACHE_PREFIX = 'nba_branch_';
const CACHE_INDEX_KEY = 'nba_branch_index';

/** Get the list of cached branch choice IDs */
export function getCachedBranchIds(): string[] {
  try {
    const raw = localStorage.getItem(CACHE_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/** Save a generated branch to localStorage */
export function saveBranchToCache(
  choiceId: string,
  events: GeneratedEvent[],
): void {
  try {
    const key = CACHE_PREFIX + choiceId;
    localStorage.setItem(key, JSON.stringify(events));

    // Update index
    const index = getCachedBranchIds();
    if (!index.includes(choiceId)) {
      index.push(choiceId);
      localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
    }
  } catch (e) {
    console.warn('Failed to cache branch:', e);
  }
}

/** Load a cached branch from localStorage */
export function loadBranchFromCache(
  choiceId: string,
): GeneratedEvent[] | null {
  try {
    const key = CACHE_PREFIX + choiceId;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as GeneratedEvent[];
  } catch {
    return null;
  }
}

/** Clear a specific cached branch */
export function clearBranchCache(choiceId: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + choiceId);
    const index = getCachedBranchIds().filter((id) => id !== choiceId);
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // ignore
  }
}

/** Clear all cached branches */
export function clearAllCache(): void {
  try {
    const index = getCachedBranchIds();
    for (const id of index) {
      localStorage.removeItem(CACHE_PREFIX + id);
    }
    localStorage.removeItem(CACHE_INDEX_KEY);
  } catch {
    // ignore
  }
}

/** React hook: track which branches are cached */
export function useCachedBranches() {
  const [cachedIds, setCachedIds] = useState<string[]>([]);

  useEffect(() => {
    setCachedIds(getCachedBranchIds());
  }, []);

  const refresh = useCallback(() => {
    setCachedIds(getCachedBranchIds());
  }, []);

  return { cachedIds, refresh };
}
