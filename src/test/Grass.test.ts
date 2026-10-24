import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { Grass } from '../grass'

const halfCoverageMap = (): THREE.DataTexture => {
  const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1)
  map.magFilter = THREE.NearestFilter
  map.minFilter = THREE.NearestFilter
  map.flipY = false
  map.needsUpdate = true
  return map
}

describe('Grass facade', () => {
  it('loads a coverage map URL and refreshes vegetation when it becomes readable', async () => {
    const pixels = new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255])
    const map = new THREE.DataTexture(pixels, 2, 1)
    map.magFilter = THREE.NearestFilter
    map.minFilter = THREE.NearestFilter
    map.flipY = false
    const load = vi
      .spyOn(THREE.TextureLoader.prototype, 'load')
      .mockImplementation((_url, onLoad) => {
        queueMicrotask(() => {
          pixels.set([255, 255, 255, 255], 0)
          map.needsUpdate = true
          onLoad?.(map as unknown as THREE.Texture<HTMLImageElement>)
        })
        return map as unknown as THREE.Texture<HTMLImageElement>
      })
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const meadow = new Grass({
      surface,
      coverage: { map: '/coverage.png' },
      grass: { density: 10 },
      wildflowers: { density: 4, maxCount: 100 },
    })

    expect(meadow.ready).toBeInstanceOf(Promise)
    expect(meadow.bladeCount).toBe(0)
    await meadow.ready
    expect(load).toHaveBeenCalledWith(
      '/coverage.png',
      expect.any(Function),
      undefined,
      expect.any(Function),
    )
    expect(meadow.bladeCount).toBe(20)
    expect(meadow.wildflowerCount).toBe(8)
    meadow.dispose()
    load.mockRestore()
  })

  it('disposes URL coverage maps that it loaded itself', () => {
    const map = new THREE.Texture() as unknown as THREE.Texture<HTMLImageElement>
    const dispose = vi.spyOn(map, 'dispose')
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(map)
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const meadow = new Grass({
      surface,
      coverage: { map: '/coverage.png' },
      wildflowers: { enabled: false },
    })

    meadow.dispose()

    expect(dispose).toHaveBeenCalledTimes(1)
    load.mockRestore()
  })

  it('rejects coverage that cannot be sampled before mutating facade state', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3),
    )
    const surface = new THREE.Mesh(geometry)
    const meadow = new Grass({
      surface,
      coverage: { sample: () => 1 },
      grass: { density: 1 },
      wildflowers: { density: 1, maxCount: 10 },
    })
    const bladeCount = meadow.bladeCount
    const wildflowerCount = meadow.wildflowerCount
    const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)

    expect(() => meadow.setOptions({ wildflowers: { coverage: { map } } })).toThrow(
      /requires a surface uv attribute/,
    )
    expect(meadow.options.coverage?.sample).toBeDefined()
    expect(meadow.options.wildflowers.coverage).toBeUndefined()
    expect(meadow.bladeCount).toBe(bladeCount)
    expect(meadow.wildflowerCount).toBe(wildflowerCount)

    expect(() => meadow.setOptions({ coverage: { attribute: 'missing' } })).toThrow(
      /"missing" was not found/,
    )
    expect(meadow.options.coverage?.sample).toBeDefined()
    expect(meadow.bladeCount).toBe(bladeCount)
    expect(meadow.wildflowerCount).toBe(wildflowerCount)
    meadow.dispose()
  })

  it('releases a replaced URL coverage map', () => {
    const firstMap = new THREE.Texture() as unknown as THREE.Texture<HTMLImageElement>
    const secondMap = new THREE.Texture() as unknown as THREE.Texture<HTMLImageElement>
    const disposeFirst = vi.spyOn(firstMap, 'dispose')
    const disposeSecond = vi.spyOn(secondMap, 'dispose')
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((url) => {
      return url === '/first.png' ? firstMap : secondMap
    })
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const meadow = new Grass({
      surface,
      coverage: { map: '/first.png' },
      wildflowers: { enabled: false },
    })

    meadow.setOptions({ coverage: { map: '/second.png' } })

    expect(disposeFirst).toHaveBeenCalledTimes(1)
    meadow.dispose()
    expect(disposeSecond).toHaveBeenCalledTimes(1)
    load.mockRestore()
  })

  it('shares coverage with wildflowers unless they provide an override', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const meadow = new Grass({
      surface,
      coverage: { map: halfCoverageMap() },
      grass: { density: 10 },
      wildflowers: { density: 4, maxCount: 100 },
    })

    expect(meadow.bladeCount).toBe(20)
    expect(meadow.wildflowerCount).toBe(8)
    meadow.setOptions({ wildflowers: { coverage: { sample: () => 0 } } })

    expect(meadow.bladeCount).toBe(20)
    expect(meadow.wildflowerCount).toBe(0)
    meadow.dispose()
  })

  it('allows grass coverage to override the shared coverage without affecting wildflowers', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
    const meadow = new Grass({
      surface,
      coverage: { map: halfCoverageMap() },
      grass: { density: 10, coverage: { sample: () => 0 } },
      wildflowers: { density: 4, maxCount: 100 },
    })

    expect(meadow.bladeCount).toBe(0)
    expect(meadow.wildflowerCount).toBe(8)
    meadow.dispose()
  })

  it('creates a generated terrain, blades, and wildflowers by default', () => {
    const meadow = new Grass()

    expect(meadow).toBeInstanceOf(THREE.Group)
    expect(meadow.ground).toBeDefined()
    expect(meadow.surface.visible).toBe(false)
    expect(meadow.bladeCount).toBeGreaterThan(0)
    expect(meadow.wildflowerCount).toBeGreaterThan(0)
    expect(meadow.children).toContain(meadow.ground!)
    meadow.dispose()
  })

  it('normalizes default options into an immutable public snapshot', () => {
    const meadow = new Grass()

    expect(meadow.options.terrain).toMatchObject({ width: 20, depth: 20, terrainDegree: 0.8 })
    expect(meadow.options.grass.density).toBe(40)
    expect(meadow.options.grass.blade).toMatchObject({
      minWidth: 0.035,
      maxWidth: 0.16,
      minHeight: 0.705,
      maxHeight: 1.5,
      segments: 4,
      lean: 0.1,
    })
    expect(meadow.options.grass.wind).toMatchObject({
      strength: 0.22,
      speed: 1.1,
      frequency: 0.55,
      turbulence: 0.24,
      lean: 0.035,
      direction: 32,
    })
    expect(meadow.options.grass.colors.top.getHexString()).toBe('b8da57')
    expect(meadow.options.grass.brightness).toBe(0.35)
    expect(meadow.options.grass.lighting.color.getHexString()).toBe('fff5cf')
    expect(meadow.options.grass.lighting.intensity).toBe(1.1)
    expect(meadow.options.grass.seed).toBe(17)
    expect(meadow.options.grass.shadow).toBe(false)
    expect(meadow.options.wildflowers).toMatchObject({
      enabled: true,
      density: 0.84,
      maxCount: 240,
    })
    expect(meadow.options.wildflowers.seed).toBe((17 ^ 0x9e3779b9) >>> 0)
    expect(Object.isFrozen(meadow.options)).toBe(true)
    expect(Object.isFrozen(meadow.options.grass.wind)).toBe(true)
    meadow.dispose()
  })

  it('copies mutable color inputs before exposing its options snapshot', () => {
    const groundColor = new THREE.Color('#557d24')
    const meadow = new Grass({ terrain: { groundColor } })

    groundColor.set('#000000')

    expect(meadow.options.terrain.groundColor).not.toBe(groundColor)
    expect(new THREE.Color(meadow.options.terrain.groundColor).getHexString()).toBe('557d24')
    meadow.dispose()
  })

  it('renders an external surface without taking ownership of it', () => {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(4, 3).rotateX(-Math.PI / 2))
    const dispose = vi.spyOn(surface.geometry, 'dispose')
    const meadow = new Grass({ surface, wildflowers: { enabled: false } })

    expect(meadow.ground).toBeUndefined()
    expect(meadow.surface).toBe(surface)
    expect(meadow.children).not.toContain(surface)
    const visual = meadow.children.find((child) => child instanceof THREE.Mesh)
    expect(visual).toBeDefined()
    expect(visual).not.toBe(surface)
    expect((visual as THREE.Mesh).geometry).toBe(surface.geometry)
    expect((visual as THREE.Mesh).material).toBe(surface.material)
    meadow.dispose()
    expect(meadow.children).not.toContain(visual!)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('keeps the external surface visual aligned with its source mesh', () => {
    const surface = new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshBasicMaterial())
    const meadow = new Grass({ surface, wildflowers: { enabled: false } })
    const scene = new THREE.Scene()
    scene.add(meadow)
    surface.position.set(4, 2, -3)
    surface.rotation.set(0.2, 0.4, -0.1)
    surface.scale.set(1.5, 0.75, 1.2)

    meadow.update(0)
    scene.updateMatrixWorld(true)
    const visual = meadow.children.find((child) => child instanceof THREE.Mesh) as THREE.Mesh

    expect(visual.matrixWorld.elements).toEqual(surface.matrixWorld.elements)
    meadow.dispose()
  })

  it('rejects an invalid external surface', () => {
    expect(() => new Grass({ surface: new THREE.Group() as unknown as THREE.Mesh })).toThrow(
      RangeError,
    )
  })

  it('applies live grass and ground patches without replacing layers', () => {
    const meadow = new Grass()
    const blades = meadow.blades
    const ground = meadow.ground!

    meadow.setOptions({
      grass: { wind: { strength: 0.45 }, colors: { top: '#ffffff' }, shadow: false },
      terrain: { groundColor: '#245f93' },
    })

    expect(meadow.blades).toBe(blades)
    expect(meadow.ground).toBe(ground)
    expect(meadow.options.grass.wind.strength).toBe(0.45)
    expect(meadow.options.grass.colors.top.getHexString()).toBe('ffffff')
    expect(meadow.options.grass.shadow).toBe(false)
    expect(meadow.blades.blades.castShadow).toBe(false)
    expect(meadow.wildflowers!.flowers.castShadow).toBe(false)
    expect(new THREE.Color(meadow.options.terrain.groundColor).getHexString()).toBe('245f93')
    meadow.dispose()
  })

  it('keeps existing wildflowers synchronized with live grass wind and time', () => {
    const meadow = new Grass({ wildflowers: { density: 1 } })
    const flowers = meadow.wildflowers!
    const uniforms = flowers.flowers.material.uniforms

    meadow.update(3.25)
    meadow.setOptions({ grass: { wind: { strength: 0.46, direction: 90 } } })

    expect(meadow.wildflowers).toBe(flowers)
    expect(uniforms.uTime.value).toBe(3.25)
    expect(uniforms.uWindStrength.value).toBe(0.46)
    expect(uniforms.uWindDirection.value.toArray()).toEqual([0, 1])
    meadow.dispose()
  })

  it('rebuilds generated terrain and vegetation when terrain structure changes', () => {
    const meadow = new Grass({ wildflowers: { density: 1 } })
    const firstSurface = meadow.surface
    const firstBlades = meadow.blades
    const firstFlowers = meadow.wildflowers!
    const disposeFlowers = vi.spyOn(firstFlowers, 'dispose')

    meadow.setOptions({ terrain: { width: 24 } })

    expect(meadow.surface).not.toBe(firstSurface)
    expect(meadow.blades).not.toBe(firstBlades)
    expect(meadow.wildflowers).not.toBe(firstFlowers)
    expect(disposeFlowers).toHaveBeenCalledTimes(1)
    expect(meadow.options.terrain.width).toBe(24)
    meadow.dispose()
  })

  it('switches sampling surfaces without owning the caller supplied mesh', () => {
    const externalSurface = new THREE.Mesh(new THREE.PlaneGeometry(4, 3).rotateX(-Math.PI / 2))
    const meadow = new Grass()
    const generatedSurface = meadow.surface
    const generatedGeometryDispose = vi.spyOn(generatedSurface.geometry, 'dispose')
    const externalGeometryDispose = vi.spyOn(externalSurface.geometry, 'dispose')

    meadow.setOptions({ surface: externalSurface })

    expect(meadow.ground).toBeUndefined()
    expect(meadow.surface).toBe(externalSurface)
    expect(generatedGeometryDispose).toHaveBeenCalledTimes(1)
    meadow.setOptions({ surface: undefined })
    expect(meadow.ground).toBeDefined()
    expect(meadow.surface).not.toBe(externalSurface)
    meadow.dispose()
    expect(externalGeometryDispose).not.toHaveBeenCalled()
  })

  it('adds and removes wildflowers when enabled changes', () => {
    const meadow = new Grass({ wildflowers: { enabled: false } })

    expect(meadow.wildflowers).toBeUndefined()
    meadow.setOptions({ wildflowers: { enabled: true, density: 1 } })
    const flowers = meadow.wildflowers
    expect(flowers).toBeDefined()
    expect(meadow.wildflowerCount).toBeGreaterThan(0)
    const dispose = vi.spyOn(flowers!, 'dispose')
    meadow.setOptions({ wildflowers: { enabled: false } })
    expect(meadow.wildflowers).toBeUndefined()
    expect(meadow.wildflowerCount).toBe(0)
    expect(dispose).toHaveBeenCalledTimes(1)
    meadow.dispose()
  })

  it('validates patches before mutating and treats calls after disposal as safe', () => {
    const meadow = new Grass()
    const blades = meadow.blades
    const options = meadow.options as unknown as { grass: { wind: { strength: number } } }

    expect(Object.isFrozen(options.grass.wind)).toBe(true)
    expect(() => {
      options.grass.wind.strength = 9
    }).toThrow(TypeError)
    expect(() => meadow.setOptions({ grass: { density: 0 } })).toThrow(RangeError)
    expect(meadow.blades).toBe(blades)
    meadow.dispose()
    meadow.setOptions({ grass: { density: 1 } })
    expect(() => meadow.update(0)).not.toThrow()
  })

  it('retains copies of mutable input colors across later patches', () => {
    const top = new THREE.Color('#91b936')
    const meadow = new Grass({ grass: { colors: { top } } })

    top.set('#000000')
    meadow.setOptions({ grass: { wind: { strength: 0.3 } } })

    expect(meadow.options.grass.colors.top.getHexString()).toBe('91b936')
    meadow.dispose()
  })
})
