import * as THREE from 'three'
import type { NpcCrossLink, NpcTimelineEdge, NpcTimelineNode, PlayerStar } from '../types'
import { buildNpcTimelineNodeObject } from './TimelineNodeFactory'
import { flowLinkColor } from './TimelineLinkStyle'
import { playerRealColor } from '../data/keyPlayers'

function makeFlowTube(
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: string,
  radius: number,
  opacity: number,
  segmentKind: 'real' | 'parallel',
): THREE.Mesh {
  const mid = from.clone().lerp(to, 0.5)
  mid.y += segmentKind === 'parallel' ? 0.12 : 0.06
  const curve = new THREE.CatmullRomCurve3([from, mid, to])
  const geo = new THREE.TubeGeometry(curve, 12, radius, 8, false)
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
  })
  return new THREE.Mesh(geo, mat)
}

function resolveEndpoint(
  id: string,
  nodeMap: Map<string, NpcTimelineNode>,
  forkAnchors: Record<string, { x: number; y: number; z: number }>,
  starById: Map<string, PlayerStar>,
  jamesPositions?: Map<string, THREE.Vector3>,
): THREE.Vector3 | null {
  const node = nodeMap.get(id)
  if (node) return new THREE.Vector3(node.position.x, node.position.y, node.position.z)
  const james = jamesPositions?.get(id)
  if (james) return james.clone()
  if (id.startsWith('fork_anchor_')) {
    const pid = id.slice('fork_anchor_'.length)
    const anchor = forkAnchors[pid]
    if (anchor) return new THREE.Vector3(anchor.x, anchor.y, anchor.z)
  }
  if (id.startsWith('star_')) {
    const pid = id.slice('star_'.length)
    const star = starById.get(pid)
    if (star) return new THREE.Vector3(star.position.x, star.position.y, star.position.z)
  }
  return null
}

export function createPlayerTimelineNebula(scene: THREE.Scene) {
  const group = new THREE.Group()
  group.name = 'npcTimelineNebula'
  scene.add(group)

  const nodeGroups = new Map<string, THREE.Group>()
  let pulsePhase = 0

  function clearGroup() {
    nodeGroups.clear()
    while (group.children.length) {
      const c = group.children[0]
      group.remove(c)
      c.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
          else obj.material.dispose()
        }
      })
    }
  }

  function sync(
    nodes: NpcTimelineNode[],
    edges: NpcTimelineEdge[],
    crossLinks: NpcCrossLink[],
    nodeMap: Map<string, NpcTimelineNode>,
    masterBrightness: number,
    selectedPlayerId: string | null,
    playerStars: PlayerStar[],
    forkAnchors: Record<string, { x: number; y: number; z: number }>,
    jamesPositions: Map<string, THREE.Vector3>,
  ) {
    clearGroup()

    const visibleNodes = nodes.filter((n) => !n.hidden)
    const visibleIds = new Set(visibleNodes.map((n) => n.id))
    const starById = new Map(playerStars.map((s) => [s.id, s]))

    for (const star of playerStars) {
      if (star.id === 'lebron-james') continue
      const reals = visibleNodes
        .filter((n) => n.playerId === star.id && n.segmentKind === 'real')
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      if (reals.length === 0) continue
      const from = new THREE.Vector3(star.position.x, star.position.y, star.position.z)
      const to = new THREE.Vector3(reals[0].position.x, reals[0].position.y, reals[0].position.z)
      const dim = masterBrightness * 0.55 + 0.35
      const stemColor = playerRealColor(star.id)
      const tube = makeFlowTube(from, to, flowLinkColor(stemColor, 0.35, dim), 0.016, 0.48 * dim, 'real')
      tube.userData.playerId = star.id
      group.add(tube)
    }

    for (const e of edges) {
      if (e.hidden || !visibleIds.has(e.target)) continue
      const from = resolveEndpoint(e.source, nodeMap, forkAnchors, starById, jamesPositions)
      const to = resolveEndpoint(e.target, nodeMap, forkAnchors, starById, jamesPositions)
      if (!from || !to) continue

      const isReal = e.segmentKind === 'real'
      const dim = isReal ? masterBrightness * 0.55 + 0.35 : 1
      const radius = isReal ? 0.018 : 0.026
      const opacity = (isReal ? 0.55 : 0.72) * dim
      const linkColor = isReal
        ? flowLinkColor(e.color, 0.5, dim)
        : flowLinkColor(e.color, 0.75, 1)
      const tube = makeFlowTube(from, to, linkColor, radius, opacity, e.segmentKind)
      tube.userData.playerId = e.playerId
      group.add(tube)
    }

    for (const cl of crossLinks) {
      if (cl.hidden) continue
      const from = resolveEndpoint(cl.source, nodeMap, forkAnchors, starById, jamesPositions)
      const to = resolveEndpoint(cl.target, nodeMap, forkAnchors, starById, jamesPositions)
      if (!from || !to) continue
      const tube = makeFlowTube(from, to, cl.color, 0.005, 0.18, 'parallel')
      group.add(tube)
    }

    for (const n of visibleNodes) {
      const selected = selectedPlayerId === n.playerId
      const nodeGroup = buildNpcTimelineNodeObject(n, masterBrightness, selected)
      nodeGroup.position.set(n.position.x, n.position.y, n.position.z)
      nodeGroups.set(n.id, nodeGroup)
      group.add(nodeGroup)
    }
  }

  function tick(dt: number) {
    pulsePhase += dt
    nodeGroups.forEach((nodeGroup) => {
      const isLatest = nodeGroup.children.some((c) => c.name === 'npc-latest-ring')
      const selected = nodeGroup.userData.selected
      const s = 1 + Math.sin(pulsePhase * (isLatest ? 4 : 2.5)) * (isLatest ? 0.08 : 0.04)
      nodeGroup.scale.setScalar(selected ? s * 1.05 : s)
    })
  }

  function pickNode(raycaster: THREE.Raycaster): string | null {
    const meshes: THREE.Object3D[] = []
    nodeGroups.forEach((g) => meshes.push(g))
    const hits = raycaster.intersectObjects(meshes, true)
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        if (obj.userData.npcNodeId) return obj.userData.npcNodeId as string
        obj = obj.parent
      }
    }
    return null
  }

  function dispose() {
    clearGroup()
    scene.remove(group)
  }

  return { sync, tick, dispose, group, pickNode }
}
