import * as THREE from 'three'

export interface ParticleGroup {
  points: THREE.Points
  targetPositions: Float32Array
  startPositions: Float32Array
  progress: number
  direction: 'dissolve' | 'coalesce' | 'rollback'
  duration: number
  elapsed: number
  onComplete?: () => void
}

// ─── Module-level bridge (set by ThreeCanvas, called by useSSE) ───
export const particleBridge = {
  dissolveAtPositions: null as
    | ((positions: THREE.Vector3[], color: string) => void)
    | null,
  coalesceAtPosition: null as
    | ((pos: THREE.Vector3, color: string, onDone: () => void) => void)
    | null,
}

export function createParticleSystem(scene: THREE.Scene) {
  const groups: ParticleGroup[] = []

  // ─── Position-based dissolve (no mesh refs needed) ───
  function dissolveAtPositions(
    positions: THREE.Vector3[],
    color: string,
  ) {
    positions.forEach((worldPos, idx) => {
      setTimeout(() => {
        const count = 150
        const posArr = new Float32Array(count * 3)
        const targets = new Float32Array(count * 3)

        for (let i = 0; i < count; i++) {
          // Small jitter around the world position
          const jx = (Math.random() - 0.5) * 0.3
          const jy = (Math.random() - 0.5) * 0.3
          const jz = (Math.random() - 0.5) * 0.3
          posArr[i * 3] = worldPos.x + jx
          posArr[i * 3 + 1] = worldPos.y + jy
          posArr[i * 3 + 2] = worldPos.z + jz

          const angle = Math.random() * Math.PI * 2
          const dist = 2 + Math.random() * 4
          targets[i * 3] = worldPos.x + Math.cos(angle) * dist
          targets[i * 3 + 1] = worldPos.y + (Math.random() - 0.5) * dist * 2
          targets[i * 3 + 2] = worldPos.z + Math.sin(angle) * dist
        }

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))

        const mat = new THREE.PointsMaterial({
          size: 0.3,
          color: new THREE.Color(color),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 1,
        })

        const points = new THREE.Points(geo, mat)
        scene.add(points)

        groups.push({
          points,
          startPositions: new Float32Array(posArr),
          targetPositions: targets,
          progress: 0,
          direction: 'dissolve',
          duration: 0.8,
          elapsed: 0,
          onComplete: () => {
            scene.remove(points)
            geo.dispose()
            mat.dispose()
          },
        })
      }, idx * 150)
    })
  }

  // ─── Coalesce ────
  function coalesceToPosition(
    targetPosition: THREE.Vector3,
    color: string,
    onComplete: () => void,
  ) {
    const count = 200
    const positions = new Float32Array(count * 3)
    const targets = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 2 + Math.random() * 3
      positions[i * 3] = targetPosition.x + Math.sin(phi) * Math.cos(theta) * radius
      positions[i * 3 + 1] = targetPosition.y + Math.sin(phi) * Math.sin(theta) * radius
      positions[i * 3 + 2] = targetPosition.z + Math.cos(phi) * radius

      targets[i * 3] = targetPosition.x
      targets[i * 3 + 1] = targetPosition.y
      targets[i * 3 + 2] = targetPosition.z
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.3,
      color: new THREE.Color(color),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    })

    const points = new THREE.Points(geo, mat)
    scene.add(points)

    groups.push({
      points,
      startPositions: new Float32Array(positions),
      targetPositions: targets,
      progress: 0,
      direction: 'coalesce',
      duration: 1.0,
      elapsed: 0,
      onComplete: () => {
        scene.remove(points)
        geo.dispose()
        mat.dispose()
        onComplete()
      },
    })
  }

  // ─── Dissolve meshes (kept for backward compat, unused in MVP) ───
  function dissolveMeshes(
    meshes: THREE.Object3D[],
    staggerMs: number,
    onAllComplete: () => void,
  ) {
    let completed = 0
    meshes.forEach((mesh, idx) => {
      setTimeout(() => {
        const geo = extractGeometry(mesh)
        if (!geo) {
          completed++
          if (completed === meshes.length) onAllComplete()
          return
        }
        const count = Math.min(geo.attributes.position.count, 300)
        const posArr = new Float32Array(count * 3)
        const targets = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
          const gi = Math.floor(Math.random() * geo.attributes.position.count)
          const px = geo.attributes.position.getX(gi)
          const py = geo.attributes.position.getY(gi)
          const pz = geo.attributes.position.getZ(gi)
          const wp = new THREE.Vector3(px, py, pz).applyMatrix4(mesh.matrixWorld)
          posArr[i * 3] = wp.x; posArr[i * 3 + 1] = wp.y; posArr[i * 3 + 2] = wp.z
          const angle = Math.random() * Math.PI * 2; const dist = 2 + Math.random() * 4
          targets[i * 3] = wp.x + Math.cos(angle) * dist
          targets[i * 3 + 1] = wp.y + (Math.random() - 0.5) * dist * 2
          targets[i * 3 + 2] = wp.z + Math.sin(angle) * dist
        }
        const pts = new THREE.Points(
          new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(posArr, 3)),
          new THREE.PointsMaterial({ size: 0.06, color: getMeshColor(mesh), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 1 }),
        )
        scene.add(pts)
        groups.push({
          points: pts,
          startPositions: new Float32Array(posArr),
          targetPositions: targets,
          progress: 0,
          direction: 'dissolve',
          duration: 0.8,
          elapsed: 0,
          onComplete: () => { scene.remove(pts); pts.geometry.dispose(); (pts.material as THREE.Material).dispose(); completed++; if (completed === meshes.length) onAllComplete() },
        })
      }, idx * staggerMs * 1000)
    })
  }

  // ─── Update ────
  function update(deltaMs = 16) {
    const dt = deltaMs / 1000
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i]
      g.elapsed += dt
      g.progress = Math.min(g.elapsed / g.duration, 1.0)
      const posArr = g.points.geometry.attributes.position.array as Float32Array
      for (let j = 0; j < posArr.length; j += 3) {
        posArr[j] = g.startPositions[j] + (g.targetPositions[j] - g.startPositions[j]) * g.progress
        posArr[j + 1] = g.startPositions[j + 1] + (g.targetPositions[j + 1] - g.startPositions[j + 1]) * g.progress
        posArr[j + 2] = g.startPositions[j + 2] + (g.targetPositions[j + 2] - g.startPositions[j + 2]) * g.progress
      }
      g.points.geometry.attributes.position.needsUpdate = true
      if (g.direction === 'dissolve' || g.direction === 'rollback') {
        (g.points.material as THREE.PointsMaterial).opacity = 1 - g.progress
      } else {
        (g.points.material as THREE.PointsMaterial).opacity = g.progress
      }
      if (g.progress >= 1.0) {
        groups.splice(i, 1)
        g.onComplete?.()
      }
    }
  }

  // ─── Wire the bridge ───
  particleBridge.dissolveAtPositions = dissolveAtPositions
  particleBridge.coalesceAtPosition = coalesceToPosition

  return { dissolveMeshes, coalesceToPosition, update, groups }
}

// ─── Helpers ────
function getMeshColor(obj: THREE.Object3D): THREE.Color {
  let c = new THREE.Color('#ffcc88')
  obj.traverse((child) => {
    const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
    if (m?.color) c = m.color
  })
  return c
}

function extractGeometry(obj: THREE.Object3D): THREE.BufferGeometry | null {
  let found: THREE.BufferGeometry | null = null
  obj.traverse((child) => {
    if (found) return
    if ((child as THREE.Mesh).geometry) found = (child as THREE.Mesh).geometry as THREE.BufferGeometry
  })
  return found
}
