import * as THREE from 'three'
import type { PlayerStar } from '../types'
import { getStarTexture } from '../utils/starTexture'

interface StarEntry {
  id: string
  core: THREE.Sprite
  halo: THREE.Sprite
  label: THREE.Sprite
}

const labelCache = new Map<string, THREE.Texture>()

function labelTexture(name: string, color: string): THREE.Texture {
  const key = `${name}_${color}`
  const cached = labelCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 64)
  ctx.font = 'bold 28px "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = 6
  ctx.fillText(name, 128, 32)

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  labelCache.set(key, tex)
  return tex
}

function makeStarSprite(color: string, opacity: number, additive: boolean): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: getStarTexture(),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
  return new THREE.Sprite(mat)
}

function makeLabelSprite(name: string, color: string): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: labelTexture(name, color),
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  })
  return new THREE.Sprite(mat)
}

export function createPlayerConstellation(scene: THREE.Scene) {
  const group = new THREE.Group()
  group.name = 'playerConstellation'
  scene.add(group)

  const entries = new Map<string, StarEntry>()
  const positions = new Map<string, THREE.Vector3>()
  let pulsePhase = 0

  const rippleGroup = new THREE.Group()
  rippleGroup.name = 'rippleGroup'
  group.add(rippleGroup)

  function syncPlayers(
    players: PlayerStar[],
    pulsingIds: Set<string>,
    fates: Record<string, { totalSwing: number }>,
  ) {
    const ids = new Set(players.map((p) => p.id))

    for (const [id, entry] of entries) {
      if (!ids.has(id)) {
        group.remove(entry.core, entry.halo, entry.label)
        entries.delete(id)
      }
    }

    for (const p of players) {
      const isPulsing = pulsingIds.has(p.id)
      const swing = fates[p.id]?.totalSwing ?? 0
      const pulse = isPulsing ? 1 + Math.sin(pulsePhase * 5) * 0.14 : 1
      const ratingScale = 0.55 + (p.rating / 100) * 0.45
    const swingBoost = Math.min(swing / 60, 0.35)
    const baseScale = ratingScale * pulse * (1 + swingBoost * 0.15)

      let entry = entries.get(p.id)
      if (!entry) {
        entry = {
          id: p.id,
          halo: makeStarSprite(p.color, 0.35, true),
          core: makeStarSprite(p.color, 0.95, false),
          label: makeLabelSprite(p.nameZh, p.color),
        }
        group.add(entry.halo, entry.core, entry.label)
        entries.set(p.id, entry)
      }

      const pos = new THREE.Vector3(p.position.x, p.position.y, p.position.z)
      positions.set(p.id, pos.clone())

      entry.core.position.copy(pos)
      entry.halo.position.copy(pos)
      entry.label.position.set(pos.x, pos.y - baseScale * 0.72, pos.z)

      entry.core.scale.setScalar(baseScale * (isPulsing ? 1.12 : 1))
      entry.halo.scale.setScalar(baseScale * 2.4)
      entry.label.scale.set(1.4, 0.36, 1)

      const coreMat = entry.core.material as THREE.SpriteMaterial
      coreMat.color.set(p.color)
      coreMat.opacity = isPulsing ? 1 : 0.75 + swingBoost * 0.25

      const haloMat = entry.halo.material as THREE.SpriteMaterial
      haloMat.color.set(p.color)
      haloMat.opacity = isPulsing ? 0.55 : 0.15 + swingBoost * 0.25
    }
  }

  function syncRippleEdges(
    edges: { source: string; target: string; color: string }[],
    nodePositions: Map<string, THREE.Vector3>,
  ) {
    while (rippleGroup.children.length) {
      const c = rippleGroup.children[0]
      rippleGroup.remove(c)
      if (c instanceof THREE.Line) {
        c.geometry.dispose()
        ;(c.material as THREE.Material).dispose()
      }
    }

    for (const e of edges) {
      const from = nodePositions.get(e.source)
      const to = nodePositions.get(e.target)
      if (!from || !to) continue
      const geo = new THREE.BufferGeometry().setFromPoints([from, to])
      const mat = new THREE.LineBasicMaterial({
        color: e.color,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      })
      rippleGroup.add(new THREE.Line(geo, mat))
    }
  }

  function tick(dt: number) {
    pulsePhase += dt
  }

  function getPlayerPosition(id: string): THREE.Vector3 | null {
    return positions.get(id)?.clone() ?? null
  }

  function pickStar(raycaster: THREE.Raycaster): string | null {
    let bestId: string | null = null
    let bestDist = Infinity
    for (const [id, entry] of entries) {
      const dist = raycaster.ray.distanceToPoint(entry.core.position)
      const hitRadius = entry.core.scale.x * 0.55
      if (dist < hitRadius && dist < bestDist) {
        bestDist = dist
        bestId = id
      }
    }
    return bestId
  }

  function dispose() {
    for (const entry of entries.values()) {
      entry.core.material.dispose()
      entry.halo.material.dispose()
      entry.label.material.dispose()
    }
    scene.remove(group)
    entries.clear()
    positions.clear()
  }

  return { syncPlayers, syncRippleEdges, getPlayerPosition, pickStar, tick, dispose, group }
}
