import type { GraphEdge, GraphNode } from '../types'

export interface Vec3 {
  x: number
  y: number
  z: number
}

const PARALLEL_STEP_X = 0.45
const PARALLEL_STEP_Y = 0.95
const PARALLEL_STEP_Z = -1.25

/** Match parallel event placement in useSSE timeline_event handler. */
export function computeParallelEventPosition(
  anchor: Vec3,
  stepIndex: number,
): Vec3 {
  const t = stepIndex
  return {
    x: anchor.x + t * PARALLEL_STEP_X + Math.sin(t * 0.55) * 0.25,
    y: anchor.y + t * PARALLEL_STEP_Y + 0.35,
    z: anchor.z + t * PARALLEL_STEP_Z - 0.55,
  }
}

/** Place the next fork one step after the chain tip. */
export function computeNextForkPosition(from: Vec3): Vec3 {
  return computeParallelEventPosition(from, 1)
}

function isChainEdge(e: GraphEdge): boolean {
  return !e.hidden && !e.isRipple && !e.ephemeral
}

function isParallelEvent(n: GraphNode): boolean {
  return n.type === 'event' && !n.isRealHistory
}

/** Hidden fork kept in graph only as edge anchor for visible parallel children. */
export function isGhostForkAnchor(
  node: GraphNode,
  edges: GraphEdge[],
  nodeMap: Map<string, GraphNode>,
): boolean {
  if (!node.hidden || node.type !== 'fork') return false
  return edges.some((e) => {
    if (e.hidden || e.source !== node.id) return false
    const target = nodeMap.get(e.target)
    return target != null && !target.hidden && isParallelEvent(target)
  })
}

/** Walk parallel chain from fork even if fork is hidden; return last visible node. */
export function findParallelChainTip(
  forkId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  let tip = nodeMap.get(forkId)
  if (!tip) return null

  let changed = true
  while (changed) {
    changed = false
    for (const e of edges) {
      if (e.hidden || e.isRipple || e.ephemeral || e.source !== tip!.id) continue
      const target = nodeMap.get(e.target)
      if (target && !target.hidden && isParallelEvent(target)) {
        tip = target
        changed = true
      }
    }
  }

  if (tip.hidden && tip.type === 'fork') {
    return findLatestParallelEventForFork(forkId, nodes, edges)
  }
  return tip.hidden ? null : tip
}

/** Fallback: latest visible parallel event reachable from a fork branch. */
export function findLatestParallelEventForFork(
  forkId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const visited = new Set<string>()
  const queue = [forkId]
  const parallelEvents: GraphNode[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const e of edges) {
      if (e.hidden || e.isRipple || e.ephemeral || e.source !== id) continue
      const target = nodeMap.get(e.target)
      if (!target || target.hidden) continue
      if (isParallelEvent(target)) {
        parallelEvents.push(target)
        queue.push(target.id)
      } else if (target.type === 'fork' && !target.isRealHistory) {
        queue.push(target.id)
      }
    }
  }

  if (parallelEvents.length === 0) return null
  parallelEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  return parallelEvents[parallelEvents.length - 1]
}

/** Resolve best anchor for spawning the next parallel fork. */
export function resolveParallelBranchTip(
  forkId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode | null {
  return (
    findParallelChainTip(forkId, nodes, edges) ??
    findLatestParallelEventForFork(forkId, nodes, edges)
  )
}

/** Count parallel events reachable from a fork (for step indexing). */
export function countParallelEventsFromFork(
  forkId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): number {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const visited = new Set<string>()
  const queue = [forkId]
  let count = 0

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const e of edges) {
      if (!isChainEdge(e) || e.source !== id) continue
      const target = nodeMap.get(e.target)
      if (!target || target.hidden) continue
      if (target.type === 'event' && !target.isRealHistory) {
        count++
        queue.push(target.id)
      }
    }
  }
  return count
}

export function hideEdgesForNodes(
  edges: GraphEdge[],
  hiddenNodeIds: Set<string>,
): GraphEdge[] {
  return edges.map((e) => {
    const sourceHidden = hiddenNodeIds.has(e.source)
    const targetHidden = hiddenNodeIds.has(e.target)
    // Keep edges from hidden fork → visible parallel event so the chain stays connected
    if (sourceHidden && !targetHidden) return e
    if (sourceHidden || targetHidden) return { ...e, hidden: true }
    return e
  })
}
