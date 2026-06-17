import * as THREE from 'three'

interface RipplePulse {
  from: THREE.Vector3
  to: THREE.Vector3
  color: THREE.Color
  progress: number
  duration: number
  elapsed: number
}

export const shockwaveBridge = {
  ripple: null as
    | ((from: THREE.Vector3, targets: THREE.Vector3[], color: string) => void)
    | null,
}

export function createShockwaveSystem(scene: THREE.Scene) {
  const pulses: RipplePulse[] = []
  const lineGroup = new THREE.Group()
  lineGroup.name = 'shockwaveGroup'
  scene.add(lineGroup)

  function ripple(from: THREE.Vector3, targets: THREE.Vector3[], color: string) {
    const c = new THREE.Color(color)
    targets.forEach((to, i) => {
      setTimeout(() => {
        pulses.push({
          from: from.clone(),
          to: to.clone(),
          color: c,
          progress: 0,
          duration: 0.85,
          elapsed: 0,
        })
      }, i * 100)
    })
  }

  function update(dt: number) {
    while (lineGroup.children.length) {
      const c = lineGroup.children[0]
      lineGroup.remove(c)
      if (c instanceof THREE.Line) {
        c.geometry.dispose()
        ;(c.material as THREE.Material).dispose()
      } else if (c instanceof THREE.Mesh) {
        c.geometry.dispose()
        ;(c.material as THREE.Material).dispose()
      }
    }

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i]
      p.elapsed += dt
      p.progress = Math.min(p.elapsed / p.duration, 1)

      const head = new THREE.Vector3().lerpVectors(p.from, p.to, p.progress)
      const tail = new THREE.Vector3().lerpVectors(
        p.from,
        p.to,
        Math.max(0, p.progress - 0.12),
      )

      const geo = new THREE.BufferGeometry().setFromPoints([tail, head])
      const mat = new THREE.LineBasicMaterial({
        color: p.color,
        transparent: true,
        opacity: (1 - p.progress) * 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      lineGroup.add(new THREE.Line(geo, mat))

      if (p.progress > 0.88) {
        const t = (p.progress - 0.88) / 0.12
        const ringGeo = new THREE.RingGeometry(0.02, 0.06 + t * 0.35, 32)
        const ringMat = new THREE.MeshBasicMaterial({
          color: p.color,
          transparent: true,
          opacity: (1 - p.progress) * 1.8,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.position.copy(p.to)
        ring.lookAt(p.from)
        lineGroup.add(ring)
      }

      if (p.progress >= 1) pulses.splice(i, 1)
    }
  }

  shockwaveBridge.ripple = ripple
  return { update, ripple }
}
