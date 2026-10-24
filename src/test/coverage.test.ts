import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { normalizeCoverage, validateSurfaceCoverage } from '../grass/coverage'

describe('coverage', () => {
  it('normalizes map defaults without taking texture ownership', () => {
    const map = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1)

    expect(normalizeCoverage({ map })).toMatchObject({
      map,
      channel: 'r',
      threshold: 0,
      power: 1,
    })
  })

  it('rejects mutually exclusive coverage sources and invalid scalar settings', () => {
    expect(() => normalizeCoverage({ map: new THREE.Texture(), attribute: 'coverage' })).toThrow(
      RangeError,
    )
    expect(() => normalizeCoverage({ attribute: '' })).toThrow(RangeError)
    expect(() => normalizeCoverage({ sample: () => 1, power: -1 })).toThrow(RangeError)
    expect(() => normalizeCoverage({ sample: () => 1, threshold: Number.NaN })).toThrow(RangeError)
  })

  it('rejects a map channel the texture does not contain', () => {
    const map = new THREE.DataTexture(new Uint8Array([255, 255]), 1, 1)
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1))
    const coverage = normalizeCoverage({ map, channel: 'b' })

    expect(coverage).toBeDefined()
    expect(() => validateSurfaceCoverage(surface, coverage!)).toThrow(
      /map channel is not available/,
    )
  })
})
