import { describe, expect, it } from 'vitest'
import * as grassApi from '../grass'

describe('grass public API', () => {
  it('exports the supported facade API without private implementations', () => {
    expect(Object.keys(grassApi).toSorted()).toEqual([
      'BLADE_WIDTH_CONTROL',
      'DEFAULT_GRASS_OPTIONS',
      'DEFAULT_TERRAIN_OPTIONS',
      'DEFAULT_WILDFLOWER_OPTIONS',
      'DENSITY_CONTROL',
      'Grass',
      'GrassLayerKind',
      'bladeWidthsFromControl',
      'densityFromControl',
    ])
  })
})
