import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { Wildflowers } from '../grass/Wildflowers'

const halfCoverageMap = (): THREE.DataTexture => {
  const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1)
  map.magFilter = THREE.NearestFilter
  map.minFilter = THREE.NearestFilter
  map.flipY = false
  map.needsUpdate = true
  return map
}

describe('Wildflowers', () => {
  it('uses coverage to restrict flower roots and effective count', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const flowers = new Wildflowers({
      surface,
      density: 4,
      maxCount: 100,
      seed: 9,
      coverage: { map: halfCoverageMap() },
    })
    const instance = new THREE.Matrix4()

    expect(flowers.count).toBe(8)
    for (let index = 0; index < flowers.count; index += 1) {
      flowers.flowers.getMatrixAt(index, instance)
      expect(new THREE.Vector3().setFromMatrixPosition(instance).x).toBeLessThan(0)
    }
    flowers.dispose()
  })

  it('casts alpha-masked shadows with a wind-aware depth material', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const flowers = new Wildflowers({ surface, density: 1, shadow: true })

    expect(flowers.flowers.castShadow).toBe(true)
    expect(flowers.flowers.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial)
    expect(flowers.flowers.customDepthMaterial?.alphaTest).toBe(0.28)
    expect(flowers.flowers.customDepthMaterial?.customProgramCacheKey()).toBe(
      'wildflower-wind-depth-v1',
    )
    const material = flowers.flowers.material as THREE.ShaderMaterial & {
      map?: THREE.Texture
    }
    expect(material.map).toBe(material.uniforms.uMask.value)

    flowers.setShadow(false)
    expect(flowers.flowers.castShadow).toBe(false)
    flowers.dispose()
  })

  it('creates deterministic RGB-mask flower cards with varied petal colors', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(4, 3).rotateX(-Math.PI / 2))
    const flowers = new Wildflowers({ surface, density: 2, seed: 8 })
    const card = flowers.children[0] as THREE.InstancedMesh<
      THREE.PlaneGeometry,
      THREE.ShaderMaterial
    >

    expect(flowers.count).toBe(24)
    expect(flowers.children).toHaveLength(1)
    expect(card.geometry).toBeInstanceOf(THREE.PlaneGeometry)
    expect(card.material.isShaderMaterial).toBe(true)
    expect(card.geometry.getAttribute('aVariant')).toBeDefined()
    const petalColors = card.geometry.getAttribute('aPetalColor')
    const foliageColors = card.geometry.getAttribute('aFoliageColor')
    const centreColors = card.geometry.getAttribute('aCentreColor')
    expect(petalColors).toBeDefined()
    expect(foliageColors).toBeDefined()
    expect(centreColors).toBeDefined()
    expect(
      new Set(Array.from(petalColors.array).map((value) => value.toFixed(3))).size,
    ).toBeGreaterThan(3)

    flowers.dispose()
    expect(flowers.children).toHaveLength(0)
  })

  it('constructs flowers when the random stream reaches its maximum state', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1))

    const flowers = new Wildflowers({ surface, density: 1, seed: 372584942 })

    expect(flowers.count).toBe(1)
    flowers.dispose()
  })

  it('aligns flower card height with the sampled surface normal', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    const flowers = new Wildflowers({ surface, density: 1, seed: 2 })
    const instance = new THREE.Matrix4()
    flowers.flowers.getMatrixAt(0, instance)
    const cardUp = new THREE.Vector3(0, 1, 0).transformDirection(instance)

    expect(cardUp.dot(new THREE.Vector3(0, 0, 1))).toBeGreaterThan(0.99)
    flowers.dispose()
  })

  it('updates wind uniforms and elapsed time without replacing flower cards', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const flowers = new Wildflowers({
      surface,
      density: 1,
      seed: 3,
      wind: {
        strength: 0.45,
        speed: 1.2,
        frequency: 0.7,
        turbulence: 0.3,
        lean: 0.02,
        direction: 90,
      },
    })
    const card = flowers.flowers
    const uniforms = card.material.uniforms

    flowers.update(2.5)
    flowers.setWind({
      strength: 0.2,
      speed: 0.8,
      frequency: 0.4,
      turbulence: 0.1,
      lean: 0.03,
      direction: 180,
    })

    expect(flowers.flowers).toBe(card)
    expect(uniforms.uTime.value).toBe(2.5)
    expect(uniforms.uWindStrength.value).toBe(0.2)
    expect(uniforms.uWindDirection.value.toArray()).toEqual([-1, 0])
    flowers.dispose()
  })

  it('uses a root-anchored, damped world-space wind deformation', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const flowers = new Wildflowers({ surface, density: 1, seed: 2 })
    const shader = flowers.flowers.material.vertexShader

    expect(shader).toContain('vec3 baseWorldPosition')
    expect(shader).toContain('float tipMask = uv.y * uv.y')
    expect(shader).toContain('0.45')
    flowers.dispose()
  })

  it('releases the generated mask, shader material, and card geometry once', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const flowers = new Wildflowers({ surface, density: 1, seed: 3 })
    const geometryDispose = vi.spyOn(flowers.flowers.geometry, 'dispose')
    const materialDispose = vi.spyOn(flowers.flowers.material, 'dispose')
    const maskDispose = vi.spyOn(flowers.flowers.material.uniforms.uMask.value, 'dispose')

    flowers.dispose()
    flowers.dispose()

    expect(geometryDispose).toHaveBeenCalledTimes(1)
    expect(materialDispose).toHaveBeenCalledTimes(1)
    expect(maskDispose).toHaveBeenCalledTimes(1)
  })
})
