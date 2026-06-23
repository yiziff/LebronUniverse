import type { ButterflyEntry } from '../types'

const STORAGE_PREFIX = 'nba_butterfly_v1_'

export function saveButterflyEntries(universeId: string, entries: ButterflyEntry[]): void {
  if (!universeId) return
  try {
    localStorage.setItem(
      STORAGE_PREFIX + universeId,
      JSON.stringify(entries.slice(-48)),
    )
  } catch {
    /* quota / private mode */
  }
}

export function loadButterflyEntries(universeId: string): ButterflyEntry[] {
  if (!universeId) return []
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + universeId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ButterflyEntry[]) : []
  } catch {
    return []
  }
}

export function clearButterflyEntries(universeId?: string): void {
  if (!universeId) return
  try {
    localStorage.removeItem(STORAGE_PREFIX + universeId)
  } catch {
    /* ignore */
  }
}
