import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRASS_OPTIONS,
  DEFAULT_TERRAIN_OPTIONS,
  DEFAULT_WILDFLOWER_OPTIONS,
  GrassLayerKind,
  type GrassOptions,
} from '../grass'

describe('Grass public defaults', () => {
  it('exports a deeply frozen default graph and stable layer identifiers', () => {
    expect(DEFAULT_TERRAIN_OPTIONS).toMatchObject({ width: 20, depth: 20, terrainDegree: 0.8 })
    expect(DEFAULT_GRASS_OPTIONS.density).toBe(40)
    expect(DEFAULT_GRASS_OPTIONS.blade).toMatchObject({
      minWidth: 0.035,
      maxWidth: 0.16,
      minHeight: 0.705,
      maxHeight: 1.5,
      segments: 4,
      lean: 0.1,
    })
    expect(DEFAULT_GRASS_OPTIONS.wind).toMatchObject({
      strength: 0.22,
      speed: 1.1,
      frequency: 0.55,
      turbulence: 0.24,
      lean: 0.035,
      direction: 32,
    })
    expect(DEFAULT_GRASS_OPTIONS.colors.top).toBe('#b8da57')
    expect(DEFAULT_GRASS_OPTIONS.brightness).toBe(0.35)
    expect(DEFAULT_GRASS_OPTIONS.shadow).toBe(false)
    expect(DEFAULT_GRASS_OPTIONS.lighting).toMatchObject({ color: '#fff5cf', intensity: 1.1 })
    expect(DEFAULT_WILDFLOWER_OPTIONS.enabled).toBe(true)
    expect(DEFAULT_WILDFLOWER_OPTIONS).toMatchObject({ density: 0.84, maxCount: 240 })
    expect(Object.isFrozen(DEFAULT_TERRAIN_OPTIONS)).toBe(true)
    expect(Object.isFrozen(DEFAULT_GRASS_OPTIONS)).toBe(true)
    expect(Object.isFrozen(DEFAULT_WILDFLOWER_OPTIONS)).toBe(true)
    expect(Object.isFrozen(DEFAULT_GRASS_OPTIONS.blade)).toBe(true)
    expect(Object.isFrozen(DEFAULT_GRASS_OPTIONS.wind)).toBe(true)
    expect(Object.isFrozen(DEFAULT_GRASS_OPTIONS.colors)).toBe(true)
    expect(Object.isFrozen(DEFAULT_GRASS_OPTIONS.lighting)).toBe(true)
    expect(Object.isFrozen(DEFAULT_GRASS_OPTIONS.lighting.direction)).toBe(true)

    expect(() => {
      ;(DEFAULT_GRASS_OPTIONS as { density: number }).density = 1
    }).toThrow(TypeError)
    expect(() => {
      ;(DEFAULT_GRASS_OPTIONS as { blade: { lean: number } }).blade.lean = 1
    }).toThrow(TypeError)
    expect(() => {
      ;(DEFAULT_GRASS_OPTIONS as { wind: { strength: number } }).wind.strength = 1
    }).toThrow(TypeError)
    expect(() => {
      ;(DEFAULT_GRASS_OPTIONS as { colors: { bottom: string } }).colors.bottom = '#000000'
    }).toThrow(TypeError)
    expect(() => {
      ;(DEFAULT_GRASS_OPTIONS as { lighting: { intensity: number } }).lighting.intensity = 0
    }).toThrow(TypeError)
    expect(() => {
      ;(DEFAULT_GRASS_OPTIONS.lighting.direction as unknown as number[])[0] = 0
    }).toThrow(TypeError)

    expect(GrassLayerKind.Wildflowers).toBe('wildflowers')
  })

  it('keeps facade options separate from legacy renderer inputs', () => {
    const options: GrassOptions = {
      // @ts-expect-error Flat renderer options are not part of the facade contract.
      density: 36,
    }

    expect(options).toEqual({ density: 36 })
  })
})
