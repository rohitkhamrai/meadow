/**
 * Snakes and Ladders Game Engine
 * Deterministic state transitions, coordinate math, and subtle audio cues.
 */

export interface GamePlayer {
  id: string
  name: string
  color: string
  emoji: string
  position: number // 0 = not started, 1..100
}

export interface SnakesGameState {
  players: GamePlayer[]
  activePlayerIndex: number
  lastRoll: number | null
  lastEvent: string | null
  winnerId: string | null
  revision: number
}

export interface TileCoords {
  xPercent: number // 0..100 center
  yPercent: number // 0..100 center
  row: number // 0 (bottom) to 9 (top)
  col: number // 0 (left) to 9 (right)
}

export const SNAKES_AND_LADDERS: Record<number, number> = {
  // Ladders (Climb Up)
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,

  // Snakes (Slide Down)
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78,
}

export const AVATAR_PALETTE = [
  { name: 'Iris', color: '#8b5cf6', emoji: '🌸' },
  { name: 'Buttercup', color: '#f59e0b', emoji: '🌼' },
  { name: 'Sage', color: '#10b981', emoji: '🌿' },
  { name: 'Rose', color: '#f43f5e', emoji: '🌹' },
]

/**
 * Calculates center X/Y percentages on a 10x10 boustrophedon board.
 * Tile 1: bottom-left (5%, 95%)
 * Tile 10: bottom-right (95%, 95%)
 * Tile 11: row 1 right (95%, 85%)
 * Tile 20: row 1 left (5%, 85%)
 * Tile 100: top-left (5%, 5%)
 */
export function getTileCoordinates(tileNumber: number): TileCoords {
  const clamped = Math.max(1, Math.min(100, Math.floor(tileNumber)))
  const idx = clamped - 1
  const row = Math.floor(idx / 10) // 0 at bottom, 9 at top
  const colInRow = idx % 10
  const col = row % 2 === 0 ? colInRow : 9 - colInRow

  const xPercent = (col + 0.5) * 10
  const yPercent = 100 - (row + 0.5) * 10

  return { xPercent, yPercent, row, col }
}

/**
 * Lightweight Web Audio sound generator for gentle, cozy game cues
 * that do not drown out YouTube background music or voice chat.
 */
export class GameSoundSynthesizer {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  playDiceRoll(): void {
    const ctx = this.getContext()
    if (!ctx) return

    try {
      // Noise buffer for realistic tactile dice tumble (reverse-engineered from ludo-classic)
      const bufferLength = Math.floor(ctx.sampleRate * 0.32)
      const buf = ctx.createBuffer(1, bufferLength, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 0.5) * 0.4
      }

      const s = ctx.createBufferSource()
      const g = ctx.createGain()
      s.buffer = buf
      s.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.2, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32)
      s.start()
    } catch {
      // Fallback
    }
  }

  playPawnStep(position: number): void {
    const ctx = this.getContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'

    const pentatonic = [329.63, 392.0, 440.0, 523.25, 659.25]
    const freq = pentatonic[position % pentatonic.length]
    osc.frequency.setValueAtTime(freq, now)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.11)
  }

  playSafeStar(): void {
    const ctx = this.getContext()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = [523, 659, 784, 1047]

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.07)
      gain.gain.setValueAtTime(0.1, now + idx * 0.07)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.14)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.07)
      osc.stop(now + idx * 0.07 + 0.15)
    })
  }

  playCapture(): void {
    const ctx = this.getContext()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = [260, 195, 130]

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, now + idx * 0.06)
      gain.gain.setValueAtTime(0.09, now + idx * 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.16)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.06)
      osc.stop(now + idx * 0.06 + 0.17)
    })
  }

  playLadderClimb(): void {
    const ctx = this.getContext()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = [329.63, 392.0, 523.25, 659.25] // E4, G4, C5, E5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + idx * 0.08)

      gain.gain.setValueAtTime(0.1, now + idx * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.15)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.08)
      osc.stop(now + idx * 0.08 + 0.16)
    })
  }

  playSnakeSlide(): void {
    const ctx = this.getContext()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.28)

    gain.gain.setValueAtTime(0.07, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.31)
  }

  playVictory(): void {
    const ctx = this.getContext()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.09)

      gain.gain.setValueAtTime(0.12, now + idx * 0.09)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.3)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.09)
      osc.stop(now + idx * 0.09 + 0.32)
    })
  }
}

/**
 * Pure state reducer for Snakes and Ladders
 */
export class SnakesGame {
  private state: SnakesGameState

  constructor(initialState?: SnakesGameState) {
    this.state = initialState ?? {
      players: [],
      activePlayerIndex: 0,
      lastRoll: null,
      lastEvent: 'Welcome to Meadow Snakes & Ladders! 🌸',
      winnerId: null,
      revision: 0,
    }
  }

  getState(): SnakesGameState {
    return JSON.parse(JSON.stringify(this.state)) as SnakesGameState
  }

  setState(newState: SnakesGameState): void {
    this.state = JSON.parse(JSON.stringify(newState)) as SnakesGameState
  }

  addOrUpdatePlayer(id: string, name: string): GamePlayer {
    const existing = this.state.players.find((p) => p.id === id)
    if (existing) {
      existing.name = name
      return existing
    }

    const colorIndex = this.state.players.length % AVATAR_PALETTE.length
    const palette = AVATAR_PALETTE[colorIndex]
    const newPlayer: GamePlayer = {
      id,
      name: name || palette.name,
      color: palette.color,
      emoji: palette.emoji,
      position: 0,
    }

    this.state.players.push(newPlayer)
    this.state.revision++
    return newPlayer
  }

  removePlayer(id: string): void {
    const idx = this.state.players.findIndex((p) => p.id === id)
    if (idx !== -1) {
      this.state.players.splice(idx, 1)
      if (this.state.activePlayerIndex >= this.state.players.length) {
        this.state.activePlayerIndex = 0
      }
      this.state.revision++
    }
  }

  setPlayerPosition(id: string, position: number): void {
    const player = this.state.players.find((p) => p.id === id)
    if (player) {
      player.position = Math.max(0, Math.min(100, position))
      this.state.revision++
    }
  }

  resetGame(): SnakesGameState {
    for (const player of this.state.players) {
      player.position = 0
    }
    this.state.activePlayerIndex = 0
    this.state.lastRoll = null
    this.state.lastEvent = 'Game reset! Ready to roll. 🎲'
    this.state.winnerId = null
    this.state.revision++
    return this.getState()
  }

  /**
   * Execute roll for active player.
   * If fixedRoll is provided (e.g. for deterministic unit testing), uses that roll.
   */
  roll(
    playerId?: string,
    fixedRoll?: number,
  ): {
    state: SnakesGameState
    roll: number
    climbedLadder: boolean
    slidSnake: boolean
    hasWon: boolean
  } {
    if (this.state.players.length === 0) {
      return {
        state: this.getState(),
        roll: 0,
        climbedLadder: false,
        slidSnake: false,
        hasWon: false,
      }
    }

    if (this.state.winnerId) {
      return {
        state: this.getState(),
        roll: 0,
        climbedLadder: false,
        slidSnake: false,
        hasWon: true,
      }
    }

    const activePlayer = this.state.players[this.state.activePlayerIndex]
    if (playerId && activePlayer.id !== playerId) {
      // Not this player's turn
      return {
        state: this.getState(),
        roll: 0,
        climbedLadder: false,
        slidSnake: false,
        hasWon: false,
      }
    }

    const roll = fixedRoll ?? Math.floor(Math.random() * 6) + 1
    this.state.lastRoll = roll
    this.state.revision++

    let target = activePlayer.position === 0 ? roll : activePlayer.position + roll
    let climbedLadder = false
    let slidSnake = false

    if (target > 100) {
      // Must roll exact number to reach 100
      this.state.lastEvent = `${activePlayer.name} rolled a ${roll}, but needs exact roll to reach 100!`
    } else {
      activePlayer.position = target

      // Check ladder or snake
      if (SNAKES_AND_LADDERS[target]) {
        const dest = SNAKES_AND_LADDERS[target]
        if (dest > target) {
          climbedLadder = true
          activePlayer.position = dest
          this.state.lastEvent = `${activePlayer.name} rolled a ${roll} and climbed a ladder to ${dest}! 🪜`
        } else {
          slidSnake = true
          activePlayer.position = dest
          this.state.lastEvent = `${activePlayer.name} rolled a ${roll} and slid down a snake to ${dest}! 🐍`
        }
      } else {
        this.state.lastEvent = `${activePlayer.name} rolled a ${roll} and moved to ${target}.`
      }
    }

    const hasWon = activePlayer.position === 100
    if (hasWon) {
      this.state.winnerId = activePlayer.id
      this.state.lastEvent = `🎉 ${activePlayer.name} reached tile 100 and won the game!`
    } else {
      // If player rolled a 6, they get a bonus turn! Otherwise advance to next player
      if (roll === 6) {
        this.state.lastEvent += ` Rolled a 6 — roll again! 🎲`
      } else {
        this.state.activePlayerIndex =
          (this.state.activePlayerIndex + 1) % this.state.players.length
      }
    }

    return {
      state: this.getState(),
      roll,
      climbedLadder,
      slidSnake,
      hasWon,
    }
  }
}
