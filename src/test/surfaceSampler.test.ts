import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  buildSurfaceLayout,
  sampleSurface,
  sampleSurfaceData,
  surfaceCoverageArea,
} from '../grass/surfaceSampler'

function halfCoverageMap(): THREE.DataTexture {
  const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1)
  map.magFilter = THREE.NearestFilter
  map.minFilter = THREE.NearestFilter
  map.flipY = false
  map.needsUpdate = true
  return map
}

describe('sampleSurface', () => {
  it('returns the same placements for the same seed', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(4, 3))

    expect(sampleSurface(surface, 12, 9)).toEqual(sampleSurface(surface, 12, 9))
  })

  it('returns samples on the supplied transformed plane', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(4, 2))
    surface.position.set(3, -2, 5)
    surface.rotation.set(0.45, 0.7, -0.2)
    surface.scale.set(1.25, 0.8, 1.7)
    surface.updateMatrixWorld(true)

    const samples = sampleSurface(surface, 20, 27)
    const inverseMatrix = surface.matrixWorld.clone().invert()

    expect(samples).toHaveLength(20)

    for (const sample of samples) {
      const localSample = sample.clone().applyMatrix4(inverseMatrix)
      expect(localSample.z).toBeCloseTo(0, 6)
      expect(localSample.x).toBeGreaterThanOrEqual(-2)
      expect(localSample.x).toBeLessThanOrEqual(2)
      expect(localSample.y).toBeGreaterThanOrEqual(-1)
      expect(localSample.y).toBeLessThanOrEqual(1)
    }
  })

  it('returns normalized world-space face normals with sample data', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    surface.rotation.y = Math.PI / 2
    surface.updateMatrixWorld(true)

    const samples = sampleSurfaceData(surface, 4, 11)

    expect(samples).toHaveLength(4)
    for (const sample of samples) {
      expect(sample.normal.length()).toBeCloseTo(1, 6)
      expect(sample.normal.dot(new THREE.Vector3(1, 0, 0))).toBeGreaterThan(0.999)
    }
  })

  it('selects unequal-area triangles in proportion to their areas', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 2, 0, 0, 0, 1, 0, 10, 0, 0, 14, 0, 0, 10, 2, 0],
        3,
      ),
    )
    const samples = sampleSurface(new THREE.Mesh(geometry), 10_000, 42)
    const largeTriangleCount = samples.filter((sample) => sample.x > 5).length

    expect(samples).toHaveLength(10_000)
    expect(largeTriangleCount / samples.length).toBeGreaterThan(0.76)
    expect(largeTriangleCount / samples.length).toBeLessThan(0.84)
  })

  it('samples only the covered UV region and reports its effective area', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    const coverage = { map: halfCoverageMap() }
    const samples = sampleSurfaceData(surface, 400, 14, coverage)

    expect(surfaceCoverageArea(surface, coverage)).toBeCloseTo(2, 1)
    expect(samples).toHaveLength(400)
    expect(samples.every((sample) => sample.position.x < 0)).toBe(true)
  })

  it('reuses a precomputed layout without rebuilding the surface sampler', () => {
    class CountingMesh extends THREE.Mesh {
      updates = 0
      override updateWorldMatrix(updateParents: boolean, updateChildren: boolean): void {
        this.updates += 1
        super.updateWorldMatrix(updateParents, updateChildren)
      }
    }
    const surface = new CountingMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const coverage = { map: halfCoverageMap() }
    const layout = buildSurfaceLayout(surface, coverage)
    const samples = sampleSurfaceData(surface, 40, 11, coverage, layout)

    expect(layout.coveredArea).toBeCloseTo(2, 1)
    expect(samples).toHaveLength(40)
    expect(samples.every((sample) => sample.position.x < 0)).toBe(true)
    expect(surface.updates).toBe(1)
  })

  it('keeps deterministic samples when reusing a layout', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const coverage = { map: halfCoverageMap() }
    const layout = buildSurfaceLayout(surface, coverage)

    expect(sampleSurfaceData(surface, 40, 11, coverage, layout)).toEqual(
      sampleSurfaceData(surface, 40, 11, coverage),
    )
    expect(layout.coveredArea).toBeCloseTo(surfaceCoverageArea(surface, coverage), 6)
  })

  it('estimates coverage that exists only inside large triangles', () => {
    const map = new THREE.DataTexture(
      new Uint8Array([
        0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 0,
        0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
      ]),
      3,
      3,
    )
    map.magFilter = THREE.NearestFilter
    map.minFilter = THREE.NearestFilter
    map.flipY = false
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))

    expect(surfaceCoverageArea(surface, { map })).toBeGreaterThan(0)
  })

  it('retains a coverage island that falls between the area probes', () => {
    const size = 32
    const data = new Uint8Array(size * size * 4)
    const pixel = (16 * size + 16) * 4
    data.set([255, 255, 255, 255], pixel)
    const map = new THREE.DataTexture(data, size, size)
    map.flipY = false
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))

    expect(surfaceCoverageArea(surface, { map })).toBeGreaterThan(0)
  })

  it('weights samples from a scalar geometry attribute', () => {
    const geometry = new THREE.PlaneGeometry(2, 2)
    const position = geometry.getAttribute('position')
    const values = new Float32Array(position.count)
    for (let index = 0; index < position.count; index += 1) {
      values[index] = position.getX(index) < 0 ? 1 : 0
    }
    geometry.setAttribute('coverage', new THREE.BufferAttribute(values, 1))
    const surface = new THREE.Mesh(geometry)
    const coverage = { attribute: 'coverage' }
    const samples = sampleSurface(surface, 400, 8, coverage)

    expect(samples).toEqual(sampleSurface(surface, 400, 8, coverage))
    expect(samples.reduce((total, point) => total + point.x, 0) / samples.length).toBeLessThan(
      -0.25,
    )
  })

  it('accepts a procedural callback in its selected world-space region', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    const coverage = {
      sample: ({ position }: { position: THREE.Vector3 }) => Number(position.x > 0),
    }
    const samples = sampleSurface(surface, 400, 19, coverage)

    expect(samples).toEqual(sampleSurface(surface, 400, 19, coverage))
    expect(samples).toHaveLength(400)
    expect(samples.every((sample) => sample.x > 0)).toBe(true)
  })

  it('fills the requested count for sparse coverage', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(100, 100))
    const samples = sampleSurfaceData(surface, 100, 21, { sample: () => 0.01 })

    expect(samples).toHaveLength(100)
  })

  it('returns no samples for an empty geometry', () => {
    expect(sampleSurface(new THREE.Mesh(new THREE.BufferGeometry()), 6, 4)).toEqual([])
  })

  it('returns no samples for a degenerate surface', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3),
    )
    const surface = new THREE.Mesh(geometry)

    expect(sampleSurface(surface, 6, 4)).toEqual([])
  })
})
