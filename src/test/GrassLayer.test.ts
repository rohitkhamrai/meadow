import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { GrassLayer } from '../grass/GrassLayer'

const horizontalSurface = (width = 2, depth = 2): THREE.Mesh =>
  new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2))

const halfCoverageMap = (): THREE.DataTexture => {
  const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1)
  map.magFilter = THREE.NearestFilter
  map.minFilter = THREE.NearestFilter
  map.flipY = false
  map.needsUpdate = true
  return map
}

const assertGrassLayerOptions = (): void => {
  // @ts-expect-error GrassLayer construction requires a sampling surface.
  const missingSurface = new GrassLayer({ density: 1 })

  // @ts-expect-error Terrain dimensions are not GrassLayer options.
  const invalidDimensions = new GrassLayer({ surface: horizontalSurface(), width: 2 })

  void [missingSurface, invalidDimensions]
}

void assertGrassLayerOptions

describe('GrassLayer', () => {
  it('uses coverage to rebuild a restricted blade layout', () => {
    const surface = horizontalSurface()
    const layer = new GrassLayer({
      surface,
      density: 10,
      seed: 6,
      coverage: { map: halfCoverageMap() },
    })
    const firstMesh = layer.blades
    const instance = new THREE.Matrix4()

    expect(layer.bladeCount).toBe(20)
    for (let index = 0; index < layer.bladeCount; index += 1) {
      layer.blades.getMatrixAt(index, instance)
      expect(new THREE.Vector3().setFromMatrixPosition(instance).x).toBeLessThan(0)
    }

    layer.setOptions({ coverage: { sample: ({ position }) => Number(position.x > 0) } })

    expect(layer.blades).not.toBe(firstMesh)
    layer.dispose()
  })

  it('keeps layer state when coverage cannot be sampled', () => {
    const layer = new GrassLayer({ surface: horizontalSurface(), density: 1, seed: 2 })
    const bladeCount = layer.bladeCount

    expect(() => layer.setOptions({ coverage: { attribute: 'missing' } })).toThrow(
      /"missing" was not found/,
    )
    expect(layer.options.coverage).toBeUndefined()
    expect(layer.bladeCount).toBe(bladeCount)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3),
    )
    const noUvLayer = new GrassLayer({ surface: new THREE.Mesh(geometry), density: 1, seed: 2 })
    const noUvCount = noUvLayer.bladeCount
    const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)

    expect(() => noUvLayer.setOptions({ coverage: { map } })).toThrow(
      /requires a surface uv attribute/,
    )
    expect(noUvLayer.options.coverage).toBeUndefined()
    expect(noUvLayer.bladeCount).toBe(noUvCount)

    noUvLayer.dispose()
    layer.dispose()
  })

  it('creates a deterministic rectangular field and rebuilds layout changes', () => {
    const layer = new GrassLayer({
      surface: horizontalSurface(),
      density: 3,
      blade: { minHeight: 0.3, maxHeight: 0.5 },
      seed: 7,
    })

    expect(layer.bladeCount).toBe(12)
    const firstMesh = layer.blades

    layer.setOptions({ density: 6 })

    expect(layer.bladeCount).toBe(24)
    expect(layer.blades).not.toBe(firstMesh)
    layer.dispose()
  })

  it('updates live wind uniforms without rebuilding its instanced mesh', () => {
    const layer = new GrassLayer({ surface: horizontalSurface(), density: 2 })
    const mesh = layer.blades

    layer.setOptions({ wind: { strength: 0.45, direction: 90 } })
    layer.update(2.5)

    expect(layer.blades).toBe(mesh)
    expect(layer.options.wind.strength).toBe(0.45)
    expect(layer.time).toBe(2.5)
    layer.dispose()
  })

  it('mirrors a directional light into the blade shader without rebuilding', () => {
    const layer = new GrassLayer({ surface: horizontalSurface(), density: 2 })
    const mesh = layer.blades
    const sun = new THREE.DirectionalLight('#ffd27a', 2.75)
    sun.position.set(-4, 8, 6)
    sun.target.position.set(1, 0, -2)

    layer.syncDirectionalLight(sun)

    const uniforms = (layer.blades.material as THREE.ShaderMaterial).uniforms
    expect(layer.blades).toBe(mesh)
    expect(uniforms.uLightDirection.value.toArray()).toEqual(
      new THREE.Vector3(-5, 8, 8).normalize().toArray(),
    )
    expect(uniforms.uLightColor.value.getHexString()).toBe('ffd27a')
    expect(uniforms.uLightIntensity.value).toBe(2.75)
    layer.dispose()
  })

  it('casts and receives directional shadows with a wind-aware depth material', () => {
    const layer = new GrassLayer({ surface: horizontalSurface(), density: 2 })

    expect(layer.blades.castShadow).toBe(true)
    expect(layer.blades.receiveShadow).toBe(true)
    expect(layer.blades.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial)
    expect(layer.blades.customDepthMaterial?.customProgramCacheKey()).toBe('grass-wind-depth-v1')

    layer.dispose()
  })

  it('toggles grass shadows without rebuilding its instanced mesh', () => {
    const layer = new GrassLayer({ surface: horizontalSurface(), density: 2 })
    const mesh = layer.blades

    layer.setOptions({ shadow: false })

    expect(layer.blades).toBe(mesh)
    expect(layer.options.shadow).toBe(false)
    expect(mesh.castShadow).toBe(false)
    expect(mesh.receiveShadow).toBe(false)

    layer.setOptions({ shadow: true })
    expect(mesh.castShadow).toBe(true)
    expect(mesh.receiveShadow).toBe(true)
    layer.dispose()
  })

  it('converts supplied world-space samples into its transformed local space', () => {
    const scene = new THREE.Scene()
    const surfaceParent = new THREE.Group()
    surfaceParent.position.set(4, 2, -3)
    surfaceParent.rotation.y = 0.4
    surfaceParent.scale.set(1.5, 1, 0.8)
    const surface = horizontalSurface()
    surfaceParent.add(surface)

    const layerParent = new THREE.Group()
    layerParent.position.set(-2, 1, 4)
    layerParent.rotation.y = -0.6
    layerParent.scale.set(0.75, 1.4, 1.2)
    const layer = new GrassLayer({ surface, density: 1, seed: 3 })
    layer.position.set(1, 0.5, -2)
    layer.rotation.y = 0.25
    layerParent.add(layer)
    scene.add(surfaceParent, layerParent)
    scene.updateWorldMatrix(true, true)

    layer.setOptions({ seed: 4 })
    scene.updateWorldMatrix(true, true)
    const instance = new THREE.Matrix4()
    layer.blades.getMatrixAt(0, instance)
    const worldBase = new THREE.Vector3()
      .setFromMatrixPosition(instance)
      .applyMatrix4(layer.matrixWorld)
    const localSurfacePoint = worldBase.applyMatrix4(surface.matrixWorld.clone().invert())

    expect(localSurfacePoint.y).toBeCloseTo(0, 6)
    expect(localSurfacePoint.x).toBeGreaterThanOrEqual(-1)
    expect(localSurfacePoint.x).toBeLessThanOrEqual(1)
    expect(localSurfacePoint.z).toBeGreaterThanOrEqual(-1)
    expect(localSurfacePoint.z).toBeLessThanOrEqual(1)
    layer.dispose()
  })

  it('rejects invalid live values and invalid update time', () => {
    const surface = horizontalSurface()
    expect(() => new GrassLayer({ surface, wind: { strength: Number.NaN } })).toThrow(RangeError)
    const layer = new GrassLayer({ surface })

    expect(() => layer.setOptions({ wind: { frequency: Number.POSITIVE_INFINITY } })).toThrow(
      RangeError,
    )
    expect(() => layer.setOptions({ lighting: { backlightPower: 0 } })).toThrow(RangeError)
    expect(() => layer.setOptions({ lighting: { backlightTip: 1.01 } })).toThrow(RangeError)
    expect(() => layer.update(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    layer.dispose()
  })

  it('merges nested live options and exposes an immutable option snapshot', () => {
    const layer = new GrassLayer({
      surface: horizontalSurface(),
      colors: { bottom: '#173b09', top: '#75a820' },
    })
    const mesh = layer.blades

    layer.setOptions({ colors: { top: '#ffffff' } })

    expect(layer.blades).toBe(mesh)
    expect(layer.options.colors.bottom.getHexString()).toBe('173b09')
    expect(layer.options.colors.top.getHexString()).toBe('ffffff')
    const exposed = layer.options as unknown as { wind: { strength: number } }
    expect(Object.isFrozen(exposed.wind)).toBe(true)
    expect(() => {
      exposed.wind.strength = 999
    }).toThrow(TypeError)
    expect(layer.options.wind.strength).toBeLessThan(1)
    expect((layer.blades.material as THREE.ShaderMaterial).uniforms.uWindStrength.value).toBe(
      layer.options.wind.strength,
    )
    layer.dispose()
  })

  it('does not dispose an externally supplied surface', () => {
    const geometry = new THREE.PlaneGeometry(2, 2)
    const material = new THREE.MeshBasicMaterial()
    const surface = new THREE.Mesh(geometry, material)
    const geometryDispose = vi.spyOn(geometry, 'dispose')
    const materialDispose = vi.spyOn(material, 'dispose')
    const layer = new GrassLayer({ surface })

    layer.dispose()
    layer.dispose()

    expect(geometryDispose).not.toHaveBeenCalled()
    expect(materialDispose).not.toHaveBeenCalled()
  })

  it('synchronizes external surface samples after scene graph attachment without setOptions', () => {
    const scene = new THREE.Scene()
    const parent = new THREE.Group()
    parent.position.set(3, 1, -2)
    parent.rotation.y = 0.5
    parent.scale.set(1.3, 1, 0.7)
    const surface = horizontalSurface()
    surface.position.set(-1, 0, 2)
    const layer = new GrassLayer({ surface, density: 1, seed: 8 })
    layer.position.set(2, 0.4, -1)
    parent.add(surface, layer)
    scene.add(parent)

    scene.updateWorldMatrix(true, true)
    layer.update(0)
    scene.updateWorldMatrix(true, true)

    const instance = new THREE.Matrix4()
    layer.blades.getMatrixAt(0, instance)
    const worldBase = new THREE.Vector3()
      .setFromMatrixPosition(instance)
      .applyMatrix4(layer.matrixWorld)
    expect(worldBase.applyMatrix4(surface.matrixWorld.clone().invert()).y).toBeCloseTo(0, 6)
    layer.dispose()
  })

  it('resynchronizes roots when the GrassLayer group or external surface moves', () => {
    const scene = new THREE.Scene()
    const surface = horizontalSurface()
    const layer = new GrassLayer({ surface, density: 1, seed: 5 })
    scene.add(surface, layer)
    scene.updateWorldMatrix(true, true)
    layer.update(0)
    surface.position.set(4, 1, -3)
    layer.position.set(-2, 0.5, 1)

    layer.update(1)
    scene.updateWorldMatrix(true, true)

    const instance = new THREE.Matrix4()
    layer.blades.getMatrixAt(0, instance)
    const worldBase = new THREE.Vector3()
      .setFromMatrixPosition(instance)
      .applyMatrix4(layer.matrixWorld)
    expect(worldBase.applyMatrix4(surface.matrixWorld.clone().invert()).y).toBeCloseTo(0, 6)
    layer.dispose()
  })

  it('disposes its current blade resources exactly once', () => {
    const layer = new GrassLayer({ surface: horizontalSurface() })
    const geometryDispose = vi.spyOn(layer.blades.geometry, 'dispose')
    const materialDispose = vi.spyOn(layer.blades.material, 'dispose')

    layer.dispose()
    layer.dispose()

    expect(geometryDispose).toHaveBeenCalledTimes(1)
    expect(materialDispose).toHaveBeenCalledTimes(1)
  })

  it('orients each blade up axis to a supplied vertical surface normal', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    const layer = new GrassLayer({ surface, density: 1, seed: 2 })
    const instance = new THREE.Matrix4()
    layer.blades.getMatrixAt(0, instance)
    const worldUp = new THREE.Vector3(0, 1, 0).transformDirection(instance)

    expect(worldUp.dot(new THREE.Vector3(0, 0, 1))).toBeGreaterThan(0.99)
    layer.dispose()
  })

  it('does not cap an explicitly requested density', () => {
    const requestedCount = 100_001
    const layer = new GrassLayer({ surface: horizontalSurface(1, 1), density: requestedCount })

    expect(layer.bladeCount).toBe(requestedCount)
    layer.dispose()
  })

  it('requires a sampling surface and does not dispose it', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    const dispose = vi.spyOn(surface.geometry, 'dispose')
    const layer = new GrassLayer({ surface, density: 1 })

    layer.dispose()

    expect(layer.children).toHaveLength(0)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('rejects a missing sampling surface', () => {
    expect(() => new GrassLayer({ density: 1 } as never)).toThrow(RangeError)
  })

  it('rejects terrain-only options without rebuilding blades', () => {
    const surface = horizontalSurface()
    expect(() => new GrassLayer({ surface, width: 4 } as never)).toThrow(RangeError)

    const layer = new GrassLayer({ surface, density: 2 })
    const mesh = layer.blades

    expect(() => layer.setOptions({ width: 4 } as never)).toThrow(RangeError)
    expect(() => layer.setOptions({ depth: 4 } as never)).toThrow(RangeError)
    expect(() => layer.setOptions({ colors: { ground: '#222222' } } as never)).toThrow(RangeError)
    expect(layer.blades).toBe(mesh)

    layer.dispose()
  })
})
