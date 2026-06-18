import * as THREE from 'three'
import type { GraphNode, NpcTimelineNode } from '../types'
import type { TimelineNodeMeta } from '../utils/timelineOrder'

type TimelineNode = GraphNode & { __meta?: TimelineNodeMeta }

/** 1 = earliest / origin, 0 = latest */
function nodeAge(meta: TimelineNodeMeta | undefined, isFork: boolean): number {
  if (isFork) return 1
  return 1 - (meta?.progress ?? 0.5)
}

function flowColor(
  baseHex: string,
  age: number,
  isRealHistory: boolean,
  masterBrightness: number,
): THREE.Color {
  const dim = new THREE.Color(0x64748b)
  const target = new THREE.Color(baseHex)
  const c = dim.clone().lerp(target, 0.35 + age * 0.55)
  if (isRealHistory) c.multiplyScalar(masterBrightness)
  return c
}

export function buildTimelineNodeObject(
  node: TimelineNode,
  featuredId: string | null,
  masterBrightness: number,
  highlightedForkId: string | null = null,
): THREE.Group {
  const group = new THREE.Group()
  group.name = `timeline-node-${node.id}`

  const meta = node.__meta
  const isFork = meta?.isFork ?? node.type === 'fork'
  const isLatest = meta?.isLatest ?? false
  const isFeatured = node.id === featuredId
  const age = nodeAge(meta, isFork)

  const color = flowColor(node.color, age, node.isRealHistory, masterBrightness)
  const size =
    node.size *
    (0.38 + age * 0.62) *
    (isFork ? 1.18 : 1) *
    (isFeatured ? 1.06 : 1) *
    (isLatest ? 0.82 : 1)

  const emissive = 0.06 + age * 0.22 + (isFeatured ? 0.08 : 0)

  if (isFork) {
    const geo = new THREE.OctahedronGeometry(size * 0.78, 0)
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      roughness: 0.78,
      metalness: 0.05,
    })
    group.add(new THREE.Mesh(geo, mat))

    const ringGeo = new THREE.TorusGeometry(size * 0.95, 0.022, 8, 40)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd4a853,
      transparent: true,
      opacity: 0.45,
    })
    group.add(new THREE.Mesh(ringGeo, ringMat))

    if (highlightedForkId === node.id && node.isClickable) {
      const hiGeo = new THREE.TorusGeometry(size * 1.35, 0.035, 8, 48)
      const hiMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.75,
      })
      const hiRing = new THREE.Mesh(hiGeo, hiMat)
      hiRing.name = 'fork-highlight-ring'
      group.add(hiRing)
    }
  } else {
    const geo = new THREE.SphereGeometry(size, 20, 20)
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: emissive,
      roughness: 0.82,
      metalness: 0.03,
      transparent: age < 0.35,
      opacity: 0.55 + age * 0.4,
    })
    group.add(new THREE.Mesh(geo, mat))

    if (isLatest) {
      const ringGeo = new THREE.RingGeometry(size * 1.08, size * 1.22, 28)
      const ringMat = new THREE.MeshBasicMaterial({
        color: node.color,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.name = 'timeline-latest-ring'
      group.add(ring)
    }
  }

  group.userData.timelineLatest = isLatest
  return group
}

export function buildNpcTimelineNodeObject(
  node: NpcTimelineNode,
  masterBrightness: number,
  selected: boolean,
): THREE.Group {
  const group = new THREE.Group()
  group.name = `npc-node-${node.id}`

  const isReal = node.segmentKind === 'real'
  const isLatest = node.isLatest ?? false
  const baseSize = node.size ?? (isReal ? 0.15 : 0.28)
  const size = baseSize * (selected ? 1.12 : 1)
  const dim = isReal ? masterBrightness * 0.5 + 0.35 : 1
  const colorHex = node.color
  const color = new THREE.Color(colorHex)
  if (isReal) color.multiplyScalar(dim * 0.85)

  const emissive = isReal ? 0.08 : 0.18 + (selected ? 0.1 : 0)

  const geo = new THREE.SphereGeometry(size, 18, 18)
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: emissive,
    roughness: 0.82,
    metalness: 0.04,
    transparent: isReal,
    opacity: isReal ? 0.55 + dim * 0.35 : 0.88,
    depthWrite: !isReal,
  })
  const sphere = new THREE.Mesh(geo, mat)
  sphere.userData.npcNodeId = node.id
  sphere.userData.playerId = node.playerId
  group.add(sphere)

  const pickGeo = new THREE.SphereGeometry(size * 2.2, 8, 8)
  const pickMat = new THREE.MeshBasicMaterial({ visible: false })
  const pickMesh = new THREE.Mesh(pickGeo, pickMat)
  pickMesh.userData.npcNodeId = node.id
  pickMesh.userData.playerId = node.playerId
  group.add(pickMesh)

  if (isLatest && !isReal) {
    const ringGeo = new THREE.RingGeometry(size * 1.1, size * 1.24, 24)
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(node.color),
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.name = 'npc-latest-ring'
    group.add(ring)
  } else if (isLatest && isReal) {
    const ringGeo = new THREE.RingGeometry(size * 1.08, size * 1.2, 20)
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(node.color),
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.name = 'npc-latest-ring'
    group.add(ring)
  }

  group.userData.npcNodeId = node.id
  group.userData.playerId = node.playerId

  if (node.isForkAnchor) {
    const ringGeo = new THREE.TorusGeometry(size * 1.35, 0.012, 6, 28)
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(node.color),
      transparent: true,
      opacity: isReal ? 0.35 : 0.5,
      depthWrite: false,
    })
    const forkRing = new THREE.Mesh(ringGeo, ringMat)
    forkRing.name = 'npc-fork-anchor-ring'
    forkRing.rotation.x = Math.PI / 2
    group.add(forkRing)
  }

  return group
}

export function buildTimelineNodeLabel(node: TimelineNode): string {
  const meta = node.__meta
  const isFork = meta?.isFork ?? node.type === 'fork'
  const isLatest = meta?.isLatest ?? false
  const year = node.timestamp?.slice(0, 4) ?? ''
  const short =
    node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label
  const age = nodeAge(meta, isFork)

  let badge = ''
  if (isFork) {
    badge = `<span style="color:#d4a853;font-size:9px;font-weight:700">⬤ 起点 · ${year}</span>`
  } else if (isLatest) {
    badge = `<span style="color:#94a3b8;font-size:9px;font-weight:600">▶ 最新 · ${year}</span>`
  } else {
    badge = `<span style="color:#64748b;font-size:9px">${year}</span>`
  }

  return `<div style="
    background: rgba(8,8,24,0.88);
    border: 1px solid ${node.color}${isFork ? '99' : '44'};
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 10px;
    color: #cbd5e1;
    max-width: 130px;
    text-align: center;
    pointer-events: none;
    line-height: 1.35;
  ">
    ${badge}<br/>
    <span style="opacity:${0.45 + age * 0.5}">${short}</span>
  </div>`
}
