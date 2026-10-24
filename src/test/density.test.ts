import { describe, expect, it } from 'vitest'
import { DENSITY_CONTROL, densityFromControl } from '../grass'

describe('densityFromControl', () => {
  it('allows the large-terrain density range to exceed the previous blade cap', () => {
    const eligibleArea = 11_500

    expect(eligibleArea * densityFromControl(8)).toBeCloseTo(4_600)
    expect(eligibleArea * densityFromControl(50)).toBeCloseTo(28_750)
    expect(DENSITY_CONTROL.max).toBe(1000)
    expect(eligibleArea * densityFromControl(DENSITY_CONTROL.max)).toBeGreaterThan(100_000)
    expect(densityFromControl(DENSITY_CONTROL.max)).toBeGreaterThan(densityFromControl(50))
  })
})
