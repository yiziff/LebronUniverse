import type {
  NpcTimelineEdge, NpcTimelineNode, PlayerCareerEvent,
  PlayerCareerProfile, PlayerStar,
} from '../types'
import { NEBULA_CENTER, playerColor, playerRealColor } from '../data/keyPlayers'

export const STAR_GAP = 1.0
export const REAL_STEP = 1.35
export const PEEL_GAP = 0.35
export const PARALLEL_STEP = 1.85
export const FORK_FALLBACK_DIST = 2.2
export const MIN_NODE_DIST = 1.35

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface PlayerBranchBasis {
  origin: Vec3
  radial: Vec3
  peel: Vec3
}

function vecLen(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z)
}

function normalize(v: Vec3): Vec3 {
  const len = vecLen(v)
  if (len < 0.001) return { x: 0, y: -1, z: 0 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function rotateAroundAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const k = normalize(axis)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dot = v.x * k.x + v.y * k.y + v.z * k.z
  return {
    x: v.x * cos + (k.y * v.z - k.z * v.y) * sin + k.x * dot * (1 - cos),
    y: v.y * cos + (k.z * v.x - k.x * v.z) * sin + k.y * dot * (1 - cos),
    z: v.z * cos + (k.x * v.y - k.y * v.x) * sin + k.z * dot * (1 - cos),
  }
}

/** Per-player local frame: radial = away from nebula center through star; peel = parallel branch direction. */
export function playerBranchBasis(star: PlayerStar, playerIndex: number): PlayerBranchBasis {
  const origin = { ...star.position }
  const radialRaw = {
    x: origin.x - NEBULA_CENTER.x,
    y: origin.y - NEBULA_CENTER.y,
    z: origin.z - NEBULA_CENTER.z,
  }
  let radial = normalize(radialRaw)
  if (vecLen(radialRaw) < 0.001) {
    radial = normalize({ x: Math.cos(playerIndex), y: -0.6, z: Math.sin(playerIndex) })
  }

  const up: Vec3 = { x: 0, y: 1, z: 0 }
  let peel = cross(radial, up)
  if (vecLen(peel) < 0.001) peel = cross(radial, { x: 1, y: 0, z: 0 })
  peel = normalize(peel)

  const twist = playerIndex * (Math.PI / 7) + 0.35
  peel = normalize(rotateAroundAxis(peel, radial, twist))

  return { origin, radial, peel }
}

export function realMilestonePosition(basis: PlayerBranchBasis, index: number): Vec3 {
  const d = STAR_GAP + index * REAL_STEP
  return add(basis.origin, scale(basis.radial, d))
}

/** Parallel chain grows along peel direction from fork anchor on the player's real chain. */
export function parallelBranchPosition(
  basis: PlayerBranchBasis,
  anchor: Vec3,
  step: number,
): Vec3 {
  const peelDist = PEEL_GAP + step * PARALLEL_STEP
  const wobble = Math.sin(step * 0.7) * 0.12
  return add(
    anchor,
    add(scale(basis.peel, peelDist), scale(basis.radial, wobble)),
  )
}

export function resolveParallelPositionWithSpacing(
  basis: PlayerBranchBasis,
  anchor: Vec3,
  step: number,
  existingNodes: NpcTimelineNode[],
  playerId: string,
): Vec3 {
  let pos = parallelBranchPosition(basis, anchor, step)
  for (let attempt = 0; attempt < 3; attempt++) {
    let ok = true
    for (const n of existingNodes) {
      if (n.hidden) continue
      const minDist = n.playerId === playerId ? MIN_NODE_DIST : 0.9
      if (dist(pos, n.position) < minDist) {
        ok = false
        pos = add(pos, scale(n.playerId === playerId ? basis.peel : basis.radial, n.playerId === playerId ? 0.4 : 0.25))
        break
      }
    }
    if (ok) break
  }
  return pos
}

/** Map calendar date to shared X axis (legacy / James timeline). */
export function timestampToX(timestamp: string): number {
  const [y, m, d] = timestamp.split('-').map(Number)
  const t = y + ((m - 1) * 30 + (d - 1)) / 365
  return (t - 2010.55) * 1.5
}

export function forkAnchorForPlayer(
  playerId: string,
  forkId: string,
  existingNodes: NpcTimelineNode[],
  _milestones: Record<string, PlayerCareerProfile>,
  stars: PlayerStar[],
): Vec3 {
  const forkYear = parseForkYear(forkId)
  const npcStars = stars.filter((s) => s.id !== 'lebron-james')
  const idx = npcStars.findIndex((s) => s.id === playerId)
  const star = npcStars[idx]
  if (!star) return { x: 0, y: 2, z: 0 }

  const basis = playerBranchBasis(star, idx)

  const realNodes = existingNodes
    .filter((n) => n.playerId === playerId && n.segmentKind === 'real' && !n.hidden)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  const beforeFork = realNodes.filter((n) => milestoneYear(n.timestamp) <= forkYear)
  if (beforeFork.length > 0) {
    return { ...beforeFork[beforeFork.length - 1].position }
  }

  return add(basis.origin, scale(basis.radial, STAR_GAP + FORK_FALLBACK_DIST))
}

export function npcNodeSize(segmentKind: 'real' | 'parallel', isLatest?: boolean): number {
  const base = segmentKind === 'real' ? 0.14 : 0.34
  return isLatest ? base * 1.12 : base
}

export function buildRealLanesForPlayer(
  playerId: string,
  profile: PlayerCareerProfile,
  star: PlayerStar,
  playerIndex: number,
): { nodes: NpcTimelineNode[]; edges: NpcTimelineEdge[] } {
  const basis = playerBranchBasis(star, playerIndex)
  const sorted = [...profile.real_milestones].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp),
  )
  const laneColor = playerColor(playerId)
  const realColor = playerRealColor(playerId)
  const nodes: NpcTimelineNode[] = sorted.map((m, i) => ({
    id: `npc_${playerId}_${m.timestamp}_real`,
    playerId,
    label: m.title,
    description: m.description,
    timestamp: m.timestamp,
    position: realMilestonePosition(basis, i),
    color: laneColor,
    segmentKind: 'real' as const,
    size: npcNodeSize('real', i === sorted.length - 1),
  }))

  const edges: NpcTimelineEdge[] = []
  for (let i = 1; i < nodes.length; i++) {
    edges.push({
      id: `npc_edge_${nodes[i - 1].id}_${nodes[i].id}`,
      playerId,
      source: nodes[i - 1].id,
      target: nodes[i].id,
      color: realColor,
      segmentKind: 'real',
    })
  }

  const forkYears = (profile.sensitive_to_james_forks ?? [])
    .map((y) => Number(y))
    .filter((y) => !Number.isNaN(y))
  for (const forkYear of forkYears) {
    const anchorNode = [...nodes]
      .filter((n) => milestoneYear(n.timestamp) <= forkYear)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .pop()
    if (anchorNode) {
      const idx = nodes.findIndex((n) => n.id === anchorNode.id)
      if (idx >= 0) nodes[idx] = { ...nodes[idx], isForkAnchor: true }
    }
  }

  return { nodes, edges }
}

export function buildParallelNodeAtPosition(
  event: Omit<PlayerCareerEvent, 'id'>,
  position: Vec3,
  color: string,
  eventKey: string,
  isLatest = false,
): NpcTimelineNode {
  return {
    id: `npc_${event.playerId}_${eventKey}_par`,
    playerId: event.playerId,
    label: event.title,
    description: event.description,
    timestamp: event.timestamp,
    position,
    color,
    segmentKind: 'parallel',
    size: npcNodeSize('parallel', isLatest),
    vsRealHistory: event.vsRealHistory,
    sourceEventId: event.sourceEventId,
  }
}

export function buildAllRealLanes(
  milestones: Record<string, PlayerCareerProfile>,
  stars: PlayerStar[],
): { nodes: NpcTimelineNode[]; edges: NpcTimelineEdge[] } {
  const npcStars = stars.filter((s) => s.id !== 'lebron-james')
  const allNodes: NpcTimelineNode[] = []
  const allEdges: NpcTimelineEdge[] = []

  npcStars.forEach((star, idx) => {
    const profile = milestones[star.id]
    if (!profile?.real_milestones?.length) return
    const { nodes, edges } = buildRealLanesForPlayer(star.id, profile, star, idx)
    allNodes.push(...nodes)
    allEdges.push(...edges)
  })

  return { nodes: allNodes, edges: allEdges }
}

export function parseForkYear(forkId: string): number {
  const m = forkId.match(/(\d{4})/)
  return m ? Number(m[1]) : 2010
}

export function milestoneYear(timestamp: string): number {
  return Number(timestamp.slice(0, 4))
}

export function isSensitiveToFork(
  profile: PlayerCareerProfile | undefined,
  forkYear: number,
): boolean {
  if (!profile) return false
  return profile.sensitive_to_james_forks?.includes(String(forkYear)) ?? false
}

export function connectParallelToChain(
  existingNodes: NpcTimelineNode[],
  existingEdges: NpcTimelineEdge[],
  newNode: NpcTimelineNode,
  playerId: string,
  forkAnchor?: Vec3,
): NpcTimelineEdge[] {
  const playerNodes = existingNodes.filter(
    (n) => n.playerId === playerId && !n.hidden && n.segmentKind === 'parallel',
  )
  const sorted = [...playerNodes, newNode].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id),
  )
  const idx = sorted.findIndex((n) => n.id === newNode.id)
  const extra: NpcTimelineEdge[] = []

  const prev = sorted[idx - 1]
  const next = sorted[idx + 1]

  if (!prev && forkAnchor && dist(newNode.position, forkAnchor) > 0.15) {
    extra.push({
      id: `npc_edge_fork_${playerId}_${newNode.id}`,
      playerId,
      source: `fork_anchor_${playerId}`,
      target: newNode.id,
      color: newNode.color,
      segmentKind: 'parallel',
    })
  }

  if (prev) {
    extra.push({
      id: `npc_edge_${prev.id}_${newNode.id}`,
      playerId,
      source: prev.id,
      target: newNode.id,
      color: newNode.color,
      segmentKind: 'parallel',
    })
  }
  if (next) {
    extra.push({
      id: `npc_edge_${newNode.id}_${next.id}`,
      playerId,
      source: newNode.id,
      target: next.id,
      color: newNode.color,
      segmentKind: 'parallel',
    })
  }
  return extra.filter((e) => !existingEdges.some((x) => x.id === e.id))
}

/** @deprecated use buildParallelNodeAtPosition */
export function buildParallelNode(
  event: PlayerCareerEvent,
  star: PlayerStar,
  playerIndex: number,
  color: string,
  eventKey: string,
): { node: NpcTimelineNode } {
  const basis = playerBranchBasis(star, playerIndex)
  const anchor = { ...star.position }
  const pos = parallelBranchPosition(basis, anchor, 1)
  return {
    node: buildParallelNodeAtPosition(event, pos, color, eventKey),
  }
}
