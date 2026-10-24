import { describe, expect, it } from 'vitest'
import { vegetationSeeds } from '../grass/seedStreams'

describe('vegetationSeeds', () => {
  it('derives stable but independent grass and wildflower seeds', () => {
    expect(vegetationSeeds(17)).toEqual(vegetationSeeds(17))
    expect(vegetationSeeds(17).grass).toBe(17)
    expect(vegetationSeeds(17).wildflowers).not.toBe(17)
    expect(vegetationSeeds(18)).not.toEqual(vegetationSeeds(17))
  })
})
