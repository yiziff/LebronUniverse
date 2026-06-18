import type { GraphNode, GraphEdge } from '../types'

export interface TimelineNodeMeta {
  order: number
  total: number
  isFork: boolean
  isLatest: boolean
  progress: number
  flowDir: { x: number; y: number; z: number }
}

export function computeTimelineMeta(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Map<string, TimelineNodeMeta> {
  const visible = nodes.filter((n) => !n.hidden && n.type !== 'player')
  const chainEdges = edges.filter((e) => !e.hidden && !e.isRipple && !e.ephemeral)
  const nodeById = new Map(visible.map((n) => [n.id, n]))
  const incoming = new Set(chainEdges.map((e) => e.target))

  let root =
    visible.find((n) => n.type === 'fork') ??
    visible.find((n) => !incoming.has(n.id))

  const ordered: GraphNode[] = []
  const visited = new Set<string>()
  let current = root

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    ordered.push(current)
    const out = chainEdges.find((e) => e.source === current!.id)
    current = out ? nodeById.get(out.target) : undefined
  }

  const orphans = visible
    .filter((n) => !visited.has(n.id))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  ordered.push(...orphans)

  const total = ordered.length
  const meta = new Map<string, TimelineNodeMeta>()

  for (let i = 0; i < ordered.length; i++) {
    const n = ordered[i]
    const next = ordered[i + 1]
    const prev = ordered[i - 1]

    let flowDir = { x: 1, y: 0, z: 0 }
    if (next) {
      const dx = next.position.x - n.position.x
      const dy = next.position.y - n.position.y
      const dz = next.position.z - n.position.z
      const len = Math.hypot(dx, dy, dz) || 1
      flowDir = { x: dx / len, y: dy / len, z: dz / len }
    } else if (prev) {
      const dx = n.position.x - prev.position.x
      const dy = n.position.y - prev.position.y
      const dz = n.position.z - prev.position.z
      const len = Math.hypot(dx, dy, dz) || 1
      flowDir = { x: dx / len, y: dy / len, z: dz / len }
    }

    meta.set(n.id, {
      order: i,
      total,
      isFork: n.type === 'fork',
      isLatest: i === total - 1 && total > 0,
      progress: total <= 1 ? 1 : i / (total - 1),
      flowDir,
    })
  }

  return meta
}
