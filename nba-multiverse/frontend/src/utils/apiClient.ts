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

/** Match backend custom_choice_id — SHA-256 first 12 hex chars. */
export async function hashCustomChoiceId(customText: string): Promise<string> {
  const normalized = customText.trim().toLowerCase()
  const data = new TextEncoder().encode(normalized)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `custom_${hex.slice(0, 12)}`
}

export function validateCustomText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return '请输入你的决定'
  if (trimmed.length > 200) return '决定描述不能超过 200 字'
  const reject = ['足球', '踢球', '世界杯', '乒乓球', '棒球', '橄榄球']
  for (const kw of reject) {
    if (trimmed.includes(kw)) return '请输入与 NBA 篮球相关的决定'
  }
  const hints = [
    '加盟', '签约', '留守', '交易', '骑士', '热火', '湖人', '勇士', '火箭',
    '公牛', '尼克斯', '76人', '退役', '留队', '离队', '欧文', '韦德', '冠军',
    'nba', '球队', '东部', '西部', '自由球员', '顶薪', '续约',
  ]
  const lower = trimmed.toLowerCase()
  if (!hints.some((h) => trimmed.includes(h) || lower.includes(h))) {
    return '请描述詹姆斯的篮球决定，例如「加盟芝加哥公牛」'
  }
  return null
}

/** POST SSE stream for custom James decisions. */
export async function streamCustomBranch(
  forkId: string,
  customText: string,
  onEvent: (eventType: string, data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/generate/${forkId}/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ custom_text: customText.trim() }),
    signal,
  })

  if (!res.ok) {
    let message = '自定义推演失败'
    try {
      const err = await res.json()
      if (typeof err.detail === 'string') message = err.detail
      else if (Array.isArray(err.detail)) message = err.detail[0]?.msg ?? message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('无法读取推演流')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      if (!chunk.trim()) continue
      const lines = chunk.split('\n')
      let eventType = 'message'
      let data = ''
      for (const line of lines) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim()
        else if (line.startsWith('data:')) data = line.slice(5).trim()
      }
      if (data) onEvent(eventType, data)
    }
  }
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
