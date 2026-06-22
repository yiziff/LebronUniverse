import { useCallback, useEffect, useState } from 'react'
import type {
  GeneratedEvent,
  SocialPostPayload,
  StatUpdatePayload,
} from '../types'

const CACHE_PREFIX = 'nba_branch_v2_'
const CACHE_INDEX_KEY = 'nba_branch_v2_index'

export interface CachedBranch {
  forkId: string
  choiceId: string
  events: GeneratedEvent[]
  statUpdates: StatUpdatePayload[]
  socialPosts: SocialPostPayload[]
  savedAt: number
}

export function makeBranchCacheKey(forkId: string, choiceId: string): string {
  return `${forkId}:${choiceId}`
}

function storageKey(cacheKey: string): string {
  return CACHE_PREFIX + cacheKey
}

/** Get cached branch keys (forkId:choiceId). */
export function getCachedBranchKeys(): string[] {
  try {
    const raw = localStorage.getItem(CACHE_INDEX_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

export function isBranchCached(forkId: string, choiceId: string): boolean {
  return loadBranchFromCache(forkId, choiceId) != null
}

/** Save a full generated branch to localStorage. */
export function saveBranchToCache(branch: CachedBranch): void {
  try {
    const cacheKey = makeBranchCacheKey(branch.forkId, branch.choiceId)
    localStorage.setItem(
      storageKey(cacheKey),
      JSON.stringify({ ...branch, savedAt: Date.now() }),
    )
    const index = getCachedBranchKeys()
    if (!index.includes(cacheKey)) {
      index.push(cacheKey)
      localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index))
    }
  } catch (e) {
    console.warn('Failed to cache branch:', e)
  }
}

/** Load a cached branch; migrates legacy choiceId-only keys when possible. */
export function loadBranchFromCache(
  forkId: string,
  choiceId: string,
): CachedBranch | null {
  try {
    const cacheKey = makeBranchCacheKey(forkId, choiceId)
    const raw = localStorage.getItem(storageKey(cacheKey))
    if (raw) return JSON.parse(raw) as CachedBranch

    // Legacy v1 key: choiceId only
    const legacyRaw = localStorage.getItem(`nba_branch_${choiceId}`)
    if (!legacyRaw) return null
    const events = JSON.parse(legacyRaw) as GeneratedEvent[]
    if (!Array.isArray(events) || events.length === 0) return null
    return {
      forkId,
      choiceId,
      events,
      statUpdates: [],
      socialPosts: [],
      savedAt: Date.now(),
    }
  } catch {
    return null
  }
}

export function clearBranchCache(forkId: string, choiceId: string): void {
  try {
    const cacheKey = makeBranchCacheKey(forkId, choiceId)
    localStorage.removeItem(storageKey(cacheKey))
    const index = getCachedBranchKeys().filter((k) => k !== cacheKey)
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index))
  } catch {
    /* ignore */
  }
}

export function clearAllCache(): void {
  try {
    for (const key of getCachedBranchKeys()) {
      localStorage.removeItem(storageKey(key))
    }
    localStorage.removeItem(CACHE_INDEX_KEY)
  } catch {
    /* ignore */
  }
}

/** React hook: track which branches are cached */
export function useCachedBranches() {
  const [cachedKeys, setCachedKeys] = useState<string[]>([])

  useEffect(() => {
    setCachedKeys(getCachedBranchKeys())
  }, [])

  const refresh = useCallback(() => {
    setCachedKeys(getCachedBranchKeys())
  }, [])

  return { cachedKeys, refresh }
}
