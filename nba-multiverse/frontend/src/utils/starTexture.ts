import * as THREE from 'three'

let cached: THREE.Texture | null = null

/** Soft radial gradient for star / nebula point sprites. */
export function getStarTexture(): THREE.Texture {
  if (cached) return cached

  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.08, 'rgba(255,248,240,0.95)')
  g.addColorStop(0.22, 'rgba(220,230,255,0.55)')
  g.addColorStop(0.45, 'rgba(140,180,255,0.22)')
  g.addColorStop(0.72, 'rgba(80,120,200,0.08)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  cached = new THREE.CanvasTexture(canvas)
  cached.needsUpdate = true
  return cached
}
