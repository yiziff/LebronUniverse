/** Detect whether the v0.2 backend (universe + fork generate) is available. */
let backendMode: 'full' | 'legacy' | null = null
let probePromise: Promise<'full' | 'legacy'> | null = null

export async function getBackendMode(): Promise<'full' | 'legacy'> {
  if (backendMode) return backendMode
  if (!probePromise) {
    probePromise = fetch('/api/universe')
      .then((res) => {
        backendMode = res.ok ? 'full' : 'legacy'
        return backendMode
      })
      .catch(() => {
        backendMode = 'legacy'
        return 'legacy' as const
      })
  }
  return probePromise
}

/** Call once on app boot so later code never hits /api/universe again on legacy backend. */
export function primeBackendMode(mode: 'full' | 'legacy') {
  backendMode = mode
  probePromise = Promise.resolve(mode)
}

export function generateStreamUrl(forkId: string, choiceId: string, mode: 'full' | 'legacy'): string {
  if (mode === 'full') {
    return `/api/generate/${forkId}/${choiceId}`
  }
  return `/api/generate/${choiceId}`
}

export async function syncUniverseIfAvailable(payload: unknown): Promise<void> {
  if ((await getBackendMode()) !== 'full') return
  try {
    await fetch('/api/universe/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    /* optional */
  }
}

export async function recordChoiceIfAvailable(body: unknown): Promise<void> {
  if ((await getBackendMode()) !== 'full') return
  try {
    await fetch('/api/universe/choice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    /* optional */
  }
}

export function resetBackendModeCache() {
  backendMode = null
  probePromise = null
}
