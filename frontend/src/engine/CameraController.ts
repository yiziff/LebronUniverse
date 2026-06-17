import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'

/** Default orbit target — centered on James timeline + player ring. */
const DEFAULT_TARGET = new THREE.Vector3(11, 3, 0)
const DEFAULT_CAMERA = new THREE.Vector3(11, 10, 18)

export const cameraBridge = {
  flyToBranch: null as ((lookAt: THREE.Vector3) => void) | null,
  resetView: null as (() => void) | null,
}

export class CameraController {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera
    this.controls = new OrbitControls(camera, domElement)

    camera.position.copy(DEFAULT_CAMERA)
    camera.lookAt(DEFAULT_TARGET)

    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.07
    this.controls.minDistance = 5
    this.controls.maxDistance = 56
    this.controls.maxPolarAngle = Math.PI * 0.72
    this.controls.target.copy(DEFAULT_TARGET)
    this.controls.update()
  }

  flyTo(position: THREE.Vector3, lookAt: THREE.Vector3, duration = 1.2) {
    gsap.to(this.camera.position, {
      x: position.x,
      y: position.y,
      z: position.z,
      duration,
      ease: 'power2.inOut',
    })
    gsap.to(this.controls.target, {
      x: lookAt.x,
      y: lookAt.y,
      z: lookAt.z,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => this.controls.update(),
    })
  }

  resetView(duration = 1.0) {
    this.flyTo(DEFAULT_CAMERA.clone(), DEFAULT_TARGET.clone(), duration)
  }

  setEnabled(enabled: boolean) {
    this.controls.enabled = enabled
  }

  update() {
    this.controls.update()
  }

  dispose() {
    this.controls.dispose()
  }
}
