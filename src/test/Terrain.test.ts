import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createTerrain, terrainDirtAmount } from '../grass/Terrain'

function heightRange(geometry: THREE.BufferGeometry): number {
  const positions = geometry.getAttribute('position')
  let min = Infinity
  let max = -Infinity
  for (let index = 0; index < positions.count; index += 1) {
    min = Math.min(min, positions.getY(index))
    max = Math.max(max, positions.getY(index))
  }
  return max - min
}

function triangleArea(geometry: THREE.BufferGeometry): number {
  const positions = geometry.getAttribute('position')
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let area = 0
  for (let index = 0; index < positions.count; index += 3) {
    a.fromBufferAttribute(positions, index)
    b.fromBufferAttribute(positions, index + 1)
    c.fromBufferAttribute(positions, index + 2)
    area += new THREE.Triangle(a, b, c).getArea()
  }
  return area
}

describe('procedural terrain', () => {
  it('keeps large terrain sampling detailed and predominantly vegetated', () => {
    const terrain = createTerrain({
      width: 100,
      depth: 140,
      segments: 72,
      seed: 17,
      terrainDegree: 0,
    })
    const positions = terrain.ground.geometry.getAttribute('position')
    const coverage = triangleArea(terrain.grassSurface.geometry) / (100 * 140)

    expect(positions.count).toBeGreaterThan((72 + 1) * (72 + 1))
    expect(coverage).toBeGreaterThan(0.76)
    expect(coverage).toBeLessThan(0.88)
    terrain.dispose()
  })

  it('creates varied, paint-like dirt amounts without a named route', () => {
    const values: number[] = []
    for (let z = -5; z <= 5; z += 2.5) {
      for (let x = -6; x <= 6; x += 2.5) values.push(terrainDirtAmount(x, z, 17))
    }

    expect(Math.min(...values)).toBeLessThan(0.18)
    expect(Math.max(...values)).toBeGreaterThan(0.72)
    expect(new Set(values.map((value) => value.toFixed(3))).size).toBeGreaterThan(14)
  })

  it('keeps degree zero flat and turns the same seed into hills at degree one', () => {
    const flat = createTerrain({ width: 12, depth: 9, segments: 24, seed: 4, terrainDegree: 0 })
    const rolling = createTerrain({
      width: 12,
      depth: 9,
      segments: 24,
      seed: 4,
      terrainDegree: 0.42,
    })
    const hilly = createTerrain({ width: 12, depth: 9, segments: 24, seed: 4, terrainDegree: 1 })

    expect(heightRange(flat.ground.geometry)).toBeCloseTo(0, 8)
    expect(heightRange(rolling.ground.geometry)).toBeGreaterThan(0.45)
    expect(heightRange(hilly.ground.geometry)).toBeGreaterThan(1.5)
    expect(heightRange(hilly.ground.geometry)).toBeGreaterThan(
      heightRange(rolling.ground.geometry) * 2,
    )

    flat.dispose()
    rolling.dispose()
    hilly.dispose()
  })

  it('rejects terrain-degree values outside the inclusive zero-to-one range', () => {
    expect(() => createTerrain({ terrainDegree: -0.01 })).toThrow(RangeError)
    expect(() => createTerrain({ terrainDegree: 1.01 })).toThrow(RangeError)
    expect(() => createTerrain({ terrainDegree: Number.NaN })).toThrow(RangeError)
  })

  it('uses smooth terrain lighting when relief exposes the soil surface', () => {
    const terrain = createTerrain({ width: 12, depth: 9, segments: 24, seed: 4, terrainDegree: 1 })

    expect(terrain.ground.material.flatShading).toBe(false)

    terrain.dispose()
  })

  it('updates only meadow vertex colors for a custom ground color', () => {
    const first = createTerrain({ width: 12, depth: 9, segments: 24, seed: 4, terrainDegree: 0.42 })
    const second = createTerrain({
      width: 12,
      depth: 9,
      segments: 24,
      seed: 4,
      terrainDegree: 0.42,
    })
    const custom = createTerrain({
      width: 12,
      depth: 9,
      segments: 24,
      seed: 4,
      terrainDegree: 0.42,
      groundColor: '#71439a',
    })
    const geometry = custom.ground.geometry
    const sampler = custom.grassSurface
    const beforeUpdate = new Float32Array(geometry.getAttribute('color').array)

    expect(first.ground).toBeInstanceOf(THREE.Mesh)
    expect(first.grassSurface.visible).toBe(false)
    expect(first.ground.geometry.getAttribute('position').array).toEqual(
      second.ground.geometry.getAttribute('position').array,
    )
    expect(first.ground.geometry.getAttribute('color').array).toEqual(
      second.ground.geometry.getAttribute('color').array,
    )
    expect(custom.ground.geometry.getAttribute('color').array).not.toEqual(
      first.ground.geometry.getAttribute('color').array,
    )
    expect(custom.grassSurface.geometry.getAttribute('position').count).toBeGreaterThan(0)
    expect(custom.grassSurface.geometry.getAttribute('position').count).toBeLessThan(
      custom.ground.geometry.getAttribute('position').count * 6,
    )

    custom.setGroundColor('#245f93')

    expect(custom.ground.geometry).toBe(geometry)
    expect(custom.grassSurface).toBe(sampler)
    expect(custom.ground.geometry.getAttribute('color').array).not.toEqual(beforeUpdate)

    first.dispose()
    second.dispose()
    custom.dispose()
  })

  it('orients every hilly grass sampling triangle toward the open sky', () => {
    const terrain = createTerrain({ width: 8, depth: 6, segments: 12, seed: 4, terrainDegree: 1 })
    const positions = terrain.grassSurface.geometry.getAttribute('position')
    const a = new THREE.Vector3().fromBufferAttribute(positions, 0)
    const b = new THREE.Vector3().fromBufferAttribute(positions, 1)
    const c = new THREE.Vector3().fromBufferAttribute(positions, 2)
    const normal = new THREE.Vector3().crossVectors(b.sub(a), c.sub(a)).normalize()

    expect(normal.y).toBeGreaterThan(0.65)
    terrain.dispose()
  })
})
