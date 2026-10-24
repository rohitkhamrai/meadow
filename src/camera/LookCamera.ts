import * as THREE from 'three'

export interface LookCameraOptions {
  /** Starting heading in radians. */
  yaw: number
  /** Starting pitch in radians; positive looks up. */
  pitch: number
  /** How far the heading may turn away from `yaw`, in radians. */
  yawRange: number
  pitchMin: number
  pitchMax: number
  /** Radians of rotation per pixel of drag. */
  sensitivity?: number
}

/**
 * A fixed-position camera that only looks around. It never pans, zooms or
 * moves, so the viewer always feels like they are lying in the meadow.
 */
export class LookCamera {
  private readonly camera: THREE.PerspectiveCamera
  private readonly element: HTMLElement
  private readonly options: Required<LookCameraOptions>
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ')
  private yawTarget: number
  private pitchTarget: number
  private yaw: number
  private pitch: number
  private dragging = false
  private lastX = 0
  private lastY = 0

  constructor(camera: THREE.PerspectiveCamera, element: HTMLElement, options: LookCameraOptions) {
    this.camera = camera
    this.element = element
    this.options = { sensitivity: 0.0032, ...options }
    this.yawTarget = this.yaw = options.yaw
    this.pitchTarget = this.pitch = this.clampPitch(options.pitch)

    element.style.touchAction = 'none'
    element.addEventListener('pointerdown', this.onPointerDown)
    element.addEventListener('pointermove', this.onPointerMove)
    element.addEventListener('pointerup', this.onPointerUp)
    element.addEventListener('pointercancel', this.onPointerUp)
  }

  update(timeSeconds: number): void {
    // A barely visible breathing sway, as if the head is resting on the grass.
    const breathing =
      Math.sin(timeSeconds * 0.21) * 0.012 + Math.sin(timeSeconds * 0.13 + 1.3) * 0.006
    const ease = 0.08
    this.yaw += (this.yawTarget + breathing - this.yaw) * ease
    this.pitch += (this.pitchTarget - this.pitch) * ease
    this.euler.set(this.pitch, this.yaw, 0)
    this.camera.quaternion.setFromEuler(this.euler)
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown)
    this.element.removeEventListener('pointermove', this.onPointerMove)
    this.element.removeEventListener('pointerup', this.onPointerUp)
    this.element.removeEventListener('pointercancel', this.onPointerUp)
  }

  private clampPitch(value: number): number {
    return THREE.MathUtils.clamp(value, this.options.pitchMin, this.options.pitchMax)
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.dragging = true
    this.lastX = event.clientX
    this.lastY = event.clientY
    this.element.setPointerCapture(event.pointerId)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return
    const dx = event.clientX - this.lastX
    const dy = event.clientY - this.lastY
    this.lastX = event.clientX
    this.lastY = event.clientY

    const { yaw, yawRange, sensitivity } = this.options
    if (yawRange >= Math.PI) {
      this.yawTarget -= dx * sensitivity
    } else {
      this.yawTarget = THREE.MathUtils.clamp(
        this.yawTarget - dx * sensitivity,
        yaw - yawRange,
        yaw + yawRange,
      )
    }
    // Dragging downward lifts the view, pulling scene toward viewer
    this.pitchTarget = this.clampPitch(this.pitchTarget + dy * sensitivity)
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.dragging = false
    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId)
    }
  }
}
