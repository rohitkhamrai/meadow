import { describe, it, expect } from 'vitest'
import { LudoGame, LUDO_TRACK, SAFE_STAR_TILES, getTokenCoord } from '../games/LudoGame'

describe('LudoGame Board Coordinates', () => {
  it('has exactly 52 perimeter track cells', () => {
    expect(LUDO_TRACK).toHaveLength(52)
  })

  it('contains valid 15x15 bounds for all track tiles', () => {
    for (const coord of LUDO_TRACK) {
      expect(coord.col).toBeGreaterThanOrEqual(0)
      expect(coord.col).toBeLessThanOrEqual(14)
      expect(coord.row).toBeGreaterThanOrEqual(0)
      expect(coord.row).toBeLessThanOrEqual(14)
    }
  })

  it('maps yard and start coordinates correctly', () => {
    const yardCoord = getTokenCoord(0, { id: 0, step: -1 })
    expect(yardCoord.col).toBe(2)
    expect(yardCoord.row).toBe(2)

    const startCoord = getTokenCoord(0, { id: 0, step: 0 })
    expect(startCoord.col).toBe(1)
    expect(startCoord.row).toBe(6)
  })
})

describe('LudoGame Rules Engine', () => {
  it('requires a 6 to hatch a token from yard', () => {
    const game = new LudoGame()
    game.addOrUpdatePlayer('p1', 'Rose')

    // Roll 3: cannot hatch
    const res1 = game.roll('p1', 3)
    expect(res1.state.players[0].tokens[0].step).toBe(-1)
    expect(res1.state.players[0].tokens[1].step).toBe(-1)

    // Roll 6: hatches token 0 automatically
    const res2 = game.roll('p1', 6)
    expect(res2.state.players[0].tokens[0].step).toBe(0)
    expect(res2.state.players[0].tokens[1].step).toBe(-1)
    // Bonus roll awarded for 6
    expect(res2.state.activePlayerIndex).toBe(0)
  })

  it('moves hatched token forward along track', () => {
    const game = new LudoGame()
    game.addOrUpdatePlayer('p1', 'Rose')
    game.addOrUpdatePlayer('p2', 'Sage')

    // Hatch token 0
    game.roll('p1', 6)
    expect(game.getState().players[0].tokens[0].step).toBe(0)

    // Roll 4 -> advances to step 4
    const res = game.roll('p1', 4)
    expect(res.state.players[0].tokens[0].step).toBe(4)
    // Turn passes to player 2 (Sage)
    expect(res.state.activePlayerIndex).toBe(1)
  })

  it('captures opponent token on non-safe tiles', () => {
    const game = new LudoGame()
    game.addOrUpdatePlayer('p1', 'Rose') // startIndex: 0
    game.addOrUpdatePlayer('p2', 'Sage') // startIndex: 13

    // Place p2 token at global track tile 5 (startIndex 13, step 44 = (13+44)%52 = 5)
    game.setTokenStep('p2', 0, 44)
    // p1 at step 1: (0 + 1) % 52 = 1
    game.setTokenStep('p1', 0, 1)

    expect(SAFE_STAR_TILES.has(5)).toBe(false)

    // p1 rolls 4 -> moves from step 1 to step 5. Lands on p2 at tile 5!
    const rollRes = game.roll('p1', 4)
    const p2Token = rollRes.state.players[1].tokens[0]

    expect(p2Token.step).toBe(-1) // Captured back to yard!
    // Bonus roll awarded for capture
    expect(rollRes.state.activePlayerIndex).toBe(0)
  })

  it('does not capture on safe star tiles', () => {
    const game = new LudoGame()
    game.addOrUpdatePlayer('p1', 'Rose') // startIndex: 0
    game.addOrUpdatePlayer('p2', 'Sage') // startIndex: 13

    // Safe star at tile 13 (Sage start)
    expect(SAFE_STAR_TILES.has(13)).toBe(true)
    game.setTokenStep('p2', 0, 0) // Tile 13
    game.setTokenStep('p1', 0, 10) // Tile 10

    // p1 rolls 3 -> moves to step 13 (Tile 13)
    const rollRes = game.roll('p1', 3)
    expect(rollRes.state.players[1].tokens[0].step).toBe(0) // Safe! Not captured!
  })

  it('detects victory when all tokens reach Home (step 56)', () => {
    const game = new LudoGame()
    game.addOrUpdatePlayer('p1', 'Rose')

    // Place tokens 0, 2, 3 at home (56), token 1 at 54
    game.setTokenStep('p1', 0, 56)
    game.setTokenStep('p1', 1, 54)
    game.setTokenStep('p1', 2, 56)
    game.setTokenStep('p1', 3, 56)

    // Roll exact 2
    const res = game.roll('p1', 2)
    expect(res.state.players[0].tokens[1].step).toBe(56)
    expect(res.state.winnerId).toBe('p1')
  })
})
