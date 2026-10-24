import { describe, expect, it } from 'vitest'
import { BLADE_WIDTH_CONTROL, bladeWidthsFromControl } from '../grass'

describe('bladeWidthsFromControl', () => {
  it('preserves the demo default blade width range', () => {
    expect(BLADE_WIDTH_CONTROL.default).toBe(0.16)
    expect(bladeWidthsFromControl(BLADE_WIDTH_CONTROL.default)).toEqual({
      minWidth: 0.035,
      maxWidth: 0.16,
    })
  })

  it('scales both width bounds while retaining their ratio', () => {
    const widths = bladeWidthsFromControl(0.2)

    expect(widths.maxWidth).toBe(0.2)
    expect(widths.minWidth).toBeCloseTo(0.04375)
    expect(widths.minWidth / widths.maxWidth).toBeCloseTo(0.035 / 0.16)
  })

  it('rejects non-positive and non-finite widths', () => {
    expect(() => bladeWidthsFromControl(0)).toThrow(RangeError)
    expect(() => bladeWidthsFromControl(Number.NaN)).toThrow(RangeError)
  })
})
