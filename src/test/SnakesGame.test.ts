import { describe, it, expect } from 'vitest'
import { getTileCoordinates, SnakesGame, SNAKES_AND_LADDERS } from '../games/SnakesGame'

describe('SnakesGame Coordinate Math', () => {
  it('maps bottom row (1-10) left-to-right correctly', () => {
    const tile1 = getTileCoordinates(1)
    expect(tile1.row).toBe(0)
    expect(tile1.col).toBe(0)
    expect(tile1.xPercent).toBe(5)
    expect(tile1.yPercent).toBe(95)

    const tile10 = getTileCoordinates(10)
    expect(tile10.row).toBe(0)
    expect(tile10.col).toBe(9)
    expect(tile10.xPercent).toBe(95)
    expect(tile10.yPercent).toBe(95)
  })

  it('maps second row (11-20) right-to-left correctly (boustrophedon)', () => {
    const tile11 = getTileCoordinates(11)
    expect(tile11.row).toBe(1)
    expect(tile11.col).toBe(9)
    expect(tile11.xPercent).toBe(95)
    expect(tile11.yPercent).toBe(85)

    const tile20 = getTileCoordinates(20)
    expect(tile20.row).toBe(1)
    expect(tile20.col).toBe(0)
    expect(tile20.xPercent).toBe(5)
    expect(tile20.yPercent).toBe(85)
  })

  it('maps top row (91-100) right-to-left correctly to tile 100', () => {
    const tile91 = getTileCoordinates(91)
    expect(tile91.row).toBe(9)
    expect(tile91.col).toBe(9)
    expect(tile91.xPercent).toBe(95)
    expect(tile91.yPercent).toBe(5)

    const tile100 = getTileCoordinates(100)
    expect(tile100.row).toBe(9)
    expect(tile100.col).toBe(0)
    expect(tile100.xPercent).toBe(5)
    expect(tile100.yPercent).toBe(5)
  })
})

describe('SnakesGame Rules & Turn Engine', () => {
  it('adds players with unique avatar colors', () => {
    const game = new SnakesGame()
    const p1 = game.addOrUpdatePlayer('p1', 'Alice')
    const p2 = game.addOrUpdatePlayer('p2', 'Bob')

    expect(p1.position).toBe(0)
    expect(p2.position).toBe(0)
    expect(p1.color).not.toBe(p2.color)
    expect(game.getState().players).toHaveLength(2)
  })

  it('moves pawn and climbs a ladder', () => {
    const game = new SnakesGame()
    game.addOrUpdatePlayer('p1', 'Alice')

    // Tile 4 is a ladder to 14
    expect(SNAKES_AND_LADDERS[4]).toBe(14)

    const res = game.roll('p1', 4)
    expect(res.roll).toBe(4)
    expect(res.climbedLadder).toBe(true)
    expect(res.slidSnake).toBe(false)
    expect(res.state.players[0].position).toBe(14)
  })

  it('moves pawn and slides down a snake', () => {
    const game = new SnakesGame()
    game.addOrUpdatePlayer('p1', 'Alice')
    game.addOrUpdatePlayer('p2', 'Bob')

    // Set position to 30, roll 2 -> 32 (Snake mouth to 10 on bg.jpg)
    expect(SNAKES_AND_LADDERS[32]).toBe(10)
    game.setPlayerPosition('p1', 30)

    const res = game.roll('p1', 2)
    expect(res.slidSnake).toBe(true)
    expect(res.climbedLadder).toBe(false)
    expect(res.state.players[0].position).toBe(10)
    // Rolled a 2, turn should pass to Bob (p2)
    expect(res.state.activePlayerIndex).toBe(1)
  })

  it('awards bonus turn when rolling a 6', () => {
    const game = new SnakesGame()
    game.addOrUpdatePlayer('p1', 'Alice')
    game.addOrUpdatePlayer('p2', 'Bob')

    const res = game.roll('p1', 6)
    expect(res.roll).toBe(6)
    // Turn should still be Alice (index 0)
    expect(res.state.activePlayerIndex).toBe(0)
  })

  it('requires exact roll to land on 100 and win', () => {
    const game = new SnakesGame()
    game.addOrUpdatePlayer('p1', 'Alice')

    // Start at tile 98. Roll 3 -> 101 (overshoot)
    game.setPlayerPosition('p1', 98)
    const overshootRes = game.roll('p1', 3)
    expect(overshootRes.hasWon).toBe(false)
    expect(overshootRes.state.players[0].position).toBe(98)

    // Roll exact 2 -> 100 (win)
    const winRes = game.roll('p1', 2)
    expect(winRes.hasWon).toBe(true)
    expect(winRes.state.players[0].position).toBe(100)
    expect(winRes.state.winnerId).toBe('p1')
  })

  it('resets game correctly', () => {
    const game = new SnakesGame()
    game.addOrUpdatePlayer('p1', 'Alice')
    game.roll('p1', 5)
    expect(game.getState().players[0].position).toBe(5)

    const resetState = game.resetGame()
    expect(resetState.players[0].position).toBe(0)
    expect(resetState.winnerId).toBeNull()
    expect(resetState.activePlayerIndex).toBe(0)
  })
})
