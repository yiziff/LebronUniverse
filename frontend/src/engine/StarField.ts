import * as THREE from 'three'
import { getStarTexture } from '../utils/starTexture'
import { NEBULA_CENTER } from '../data/keyPlayers'

export function createStarField(scene: THREE.Scene): THREE.Points {
  const STAR_COUNT = 4500
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const sizes = new Float32Array(STAR_COUNT)

  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const radius = 28 + Math.random() * 42
    positions[i * 3] =
      NEBULA_CENTER.x + Math.sin(phi) * Math.cos(theta) * radius
    positions[i * 3 + 1] =
      NEBULA_CENTER.y + Math.sin(phi) * Math.sin(theta) * radius * 0.6
    positions[i * 3 + 2] =
      NEBULA_CENTER.z + Math.cos(phi) * radius

    const warmth = Math.random()
    colors[i * 3] = 0.45 + warmth * 0.35
    colors[i * 3 + 1] = 0.5 + warmth * 0.25
    colors[i * 3 + 2] = 0.65 + (1 - warmth) * 0.25

    sizes[i] = Math.random() * 1.8 + 0.4
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const mat = new THREE.PointsMaterial({
    size: 0.12,
    map: getStarTexture(),
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.28,
    sizeAttenuation: true,
  })

  const stars = new THREE.Points(geo, mat)
  stars.name = 'starField'
  scene.add(stars)
  return stars
}
