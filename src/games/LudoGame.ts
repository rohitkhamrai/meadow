/**
 * Ludo Game Engine
 * Deterministic 15x15 grid topology, track traversal, safe stars, captures, and home run.
 */

export interface LudoToken {
  id: number // 0 or 1 (or 0..3)
  step: number // -1 = yard, 0..50 = global track, 51..55 = home runway, 56 = finished home
}

export interface LudoPlayer {
  id: string
  name: string
  color: string
  emoji: string
  colorName: 'Rose' | 'Sage' | 'Buttercup' | 'Iris'
  startIndex: number // 0, 13, 26, 39
  tokens: LudoToken[]
}

export interface LudoGameState {
  players: LudoPlayer[]
  activePlayerIndex: number
  lastRoll: number | null
  lastEvent: string | null
  winnerId: string | null
  waitingForTokenSelect: boolean
  eligibleTokenIds: number[]
  revision: number
}

export interface GridCoord {
  col: number // 0..14
  row: number // 0..14
}

// 52 global perimeter track cells on 15x15 grid
export const LUDO_TRACK: GridCoord[] = [
  // Red side going right then up (0..12)
  { col: 1, row: 6 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 6, row: 5 },
  { col: 6, row: 4 },
  { col: 6, row: 3 },
  { col: 6, row: 2 },
  { col: 6, row: 1 },
  { col: 6, row: 0 },
  { col: 7, row: 0 },
  { col: 8, row: 0 },

  // Green side going down then right (13..25)
  { col: 8, row: 1 },
  { col: 8, row: 2 },
  { col: 8, row: 3 },
  { col: 8, row: 4 },
  { col: 8, row: 5 },
  { col: 9, row: 6 },
  { col: 10, row: 6 },
  { col: 11, row: 6 },
  { col: 12, row: 6 },
  { col: 13, row: 6 },
  { col: 14, row: 6 },
  { col: 14, row: 7 },
  { col: 14, row: 8 },

  // Yellow side going left then down (26..38)
  { col: 13, row: 8 },
  { col: 12, row: 8 },
  { col: 11, row: 8 },
  { col: 10, row: 8 },
  { col: 9, row: 8 },
  { col: 8, row: 9 },
  { col: 8, row: 10 },
  { col: 8, row: 11 },
  { col: 8, row: 12 },
  { col: 8, row: 13 },
  { col: 8, row: 14 },
  { col: 7, row: 14 },
  { col: 6, row: 14 },

  // Blue side going up then left (39..51)
  { col: 6, row: 13 },
  { col: 6, row: 12 },
  { col: 6, row: 11 },
  { col: 6, row: 10 },
  { col: 6, row: 9 },
  { col: 5, row: 8 },
  { col: 4, row: 8 },
  { col: 3, row: 8 },
  { col: 2, row: 8 },
  { col: 1, row: 8 },
  { col: 0, row: 8 },
  { col: 0, row: 7 },
  { col: 0, row: 6 },
]

export const SAFE_STAR_TILES = new Set([0, 8, 13, 21, 26, 34, 39, 47])

export const LUDO_PALETTE: Array<{
  colorName: 'Rose' | 'Sage' | 'Buttercup' | 'Iris'
  color: string
  emoji: string
  startIndex: number
  homeRun: GridCoord[]
  homeTarget: GridCoord
  yardSlots: GridCoord[]
}> = [
  {
    colorName: 'Rose',
    color: '#f43f5e',
    emoji: '🌹',
    startIndex: 0,
    homeRun: [
      { col: 1, row: 7 },
      { col: 2, row: 7 },
      { col: 3, row: 7 },
      { col: 4, row: 7 },
      { col: 5, row: 7 },
    ],
    homeTarget: { col: 6, row: 7 },
    yardSlots: [
      { col: 2, row: 2 },
      { col: 3, row: 2 },
      { col: 2, row: 3 },
      { col: 3, row: 3 },
    ],
  },
  {
    colorName: 'Sage',
    color: '#10b981',
    emoji: '🌿',
    startIndex: 13,
    homeRun: [
      { col: 7, row: 1 },
      { col: 7, row: 2 },
      { col: 7, row: 3 },
      { col: 7, row: 4 },
      { col: 7, row: 5 },
    ],
    homeTarget: { col: 7, row: 6 },
    yardSlots: [
      { col: 11, row: 2 },
      { col: 12, row: 2 },
      { col: 11, row: 3 },
      { col: 12, row: 3 },
    ],
  },
  {
    colorName: 'Buttercup',
    color: '#f59e0b',
    emoji: '🌼',
    startIndex: 26,
    homeRun: [
      { col: 13, row: 7 },
      { col: 12, row: 7 },
      { col: 11, row: 7 },
      { col: 10, row: 7 },
      { col: 9, row: 7 },
    ],
    homeTarget: { col: 8, row: 7 },
    yardSlots: [
      { col: 11, row: 11 },
      { col: 12, row: 11 },
      { col: 11, row: 12 },
      { col: 12, row: 12 },
    ],
  },
  {
    colorName: 'Iris',
    color: '#8b5cf6',
    emoji: '🌸',
    startIndex: 39,
    homeRun: [
      { col: 7, row: 13 },
      { col: 7, row: 12 },
      { col: 7, row: 11 },
      { col: 7, row: 10 },
      { col: 7, row: 9 },
    ],
    homeTarget: { col: 7, row: 8 },
    yardSlots: [
      { col: 2, row: 11 },
      { col: 3, row: 11 },
      { col: 2, row: 12 },
      { col: 3, row: 12 },
    ],
  },
]

export function getTokenCoord(playerIndex: number, token: LudoToken): GridCoord {
  const meta = LUDO_PALETTE[playerIndex % LUDO_PALETTE.length]

  if (token.step === -1) {
    // In Yard
    return meta.yardSlots[token.id % meta.yardSlots.length]
  }

  if (token.step >= 0 && token.step <= 50) {
    // On Global Track
    const globalIdx = (meta.startIndex + token.step) % 52
    return LUDO_TRACK[globalIdx]
  }

  if (token.step >= 51 && token.step <= 55) {
    // In Home Runway
    const homeIdx = token.step - 51
    return meta.homeRun[homeIdx]
  }

  // Finished in Home Center
  return meta.homeTarget
}

export class LudoGame {
  private state: LudoGameState

  constructor(initialState?: LudoGameState) {
    this.state = initialState ?? {
      players: [],
      activePlayerIndex: 0,
      lastRoll: null,
      lastEvent: 'Welcome to Meadow Ludo! 🎲 Roll a 6 to hatch a token.',
      winnerId: null,
      waitingForTokenSelect: false,
      eligibleTokenIds: [],
      revision: 0,
    }
  }

  getState(): LudoGameState {
    return JSON.parse(JSON.stringify(this.state)) as LudoGameState
  }

  setState(newState: LudoGameState): void {
    this.state = JSON.parse(JSON.stringify(newState)) as LudoGameState
  }

  addOrUpdatePlayer(id: string, name: string): LudoPlayer {
    const existing = this.state.players.find((p) => p.id === id)
    if (existing) {
      existing.name = name
      return existing
    }

    const playerIdx = this.state.players.length % LUDO_PALETTE.length
    const palette = LUDO_PALETTE[playerIdx]

    // 2 tokens per player for snappy, cozy parlor play
    const tokens: LudoToken[] = [
      { id: 0, step: -1 },
      { id: 1, step: -1 },
    ]

    const newPlayer: LudoPlayer = {
      id,
      name: name || palette.colorName,
      color: palette.color,
      emoji: palette.emoji,
      colorName: palette.colorName,
      startIndex: palette.startIndex,
      tokens,
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

  setTokenStep(playerId: string, tokenId: number, step: number): void {
    const player = this.state.players.find((p) => p.id === playerId)
    const token = player?.tokens.find((t) => t.id === tokenId)
    if (token) {
      token.step = step
      this.state.revision++
    }
  }

  resetGame(): LudoGameState {
    for (const player of this.state.players) {
      for (const token of player.tokens) {
        token.step = -1
      }
    }
    this.state.activePlayerIndex = 0
    this.state.lastRoll = null
    this.state.lastEvent = 'Ludo reset! Ready to roll. 🎲'
    this.state.winnerId = null
    this.state.waitingForTokenSelect = false
    this.state.eligibleTokenIds = []
    this.state.revision++
    return this.getState()
  }

  roll(
    playerId?: string,
    fixedRoll?: number,
  ): {
    state: LudoGameState
    roll: number
    requiresSelection: boolean
    autoMovedTokenId?: number
  } {
    if (this.state.players.length === 0 || this.state.winnerId) {
      return { state: this.getState(), roll: 0, requiresSelection: false }
    }

    const activePlayer = this.state.players[this.state.activePlayerIndex]
    if (playerId && activePlayer.id !== playerId) {
      return { state: this.getState(), roll: 0, requiresSelection: false }
    }

    const roll = fixedRoll ?? Math.floor(Math.random() * 6) + 1
    this.state.lastRoll = roll
    this.state.revision++

    // Find eligible tokens to move
    const eligibleTokenIds: number[] = []
    for (const token of activePlayer.tokens) {
      if (token.step === -1) {
        // Need a 6 to exit Yard onto track
        if (roll === 6) eligibleTokenIds.push(token.id)
      } else if (token.step < 56) {
        // Can advance if doesn't overshoot 56 (Home)
        if (token.step + roll <= 56) {
          eligibleTokenIds.push(token.id)
        }
      }
    }

    if (eligibleTokenIds.length === 0) {
      // No moves possible
      this.state.lastEvent = `${activePlayer.name} rolled a ${roll}, but has no valid moves.`
      this.state.waitingForTokenSelect = false
      this.state.eligibleTokenIds = []

      // If rolled 6, player gets another roll even if no moves possible
      if (roll === 6) {
        this.state.lastEvent += ' Rolled a 6 — roll again! 🎲'
      } else {
        this.state.activePlayerIndex =
          (this.state.activePlayerIndex + 1) % this.state.players.length
      }

      return { state: this.getState(), roll, requiresSelection: false }
    }

    const allEligibleInYard = eligibleTokenIds.every(
      (id) => activePlayer.tokens.find((t) => t.id === id)?.step === -1,
    )

    if (eligibleTokenIds.length === 1 || allEligibleInYard) {
      // Exactly one token or all identical yard tokens: auto-move to minimize friction
      const movedTokenId = eligibleTokenIds[0]
      this.moveToken(activePlayer.id, movedTokenId)
      return {
        state: this.getState(),
        roll,
        requiresSelection: false,
        autoMovedTokenId: movedTokenId,
      }
    }

    // Multiple tokens can move with distinct choices: prompt player to tap their token
    this.state.waitingForTokenSelect = true
    this.state.eligibleTokenIds = eligibleTokenIds
    this.state.lastEvent = `${activePlayer.name} rolled a ${roll}! Tap a highlighted token to move.`

    return { state: this.getState(), roll, requiresSelection: true }
  }

  moveToken(
    playerId: string,
    tokenId: number,
  ): {
    state: LudoGameState
    capturedOpponent: boolean
    hasWon: boolean
  } {
    const activePlayer = this.state.players[this.state.activePlayerIndex]
    if (!activePlayer || activePlayer.id !== playerId) {
      return { state: this.getState(), capturedOpponent: false, hasWon: false }
    }

    const token = activePlayer.tokens.find((t) => t.id === tokenId)
    if (!token || !this.state.lastRoll) {
      return { state: this.getState(), capturedOpponent: false, hasWon: false }
    }

    const roll = this.state.lastRoll
    let capturedOpponent = false

    if (token.step === -1 && roll === 6) {
      token.step = 0 // Spawn onto track
      this.state.lastEvent = `${activePlayer.name} hatched a token onto the track! 🌱`
    } else if (token.step >= 0) {
      token.step += roll
      if (token.step === 56) {
        this.state.lastEvent = `✨ ${activePlayer.name}'s token reached Home!`
      } else {
        this.state.lastEvent = `${activePlayer.name} moved a token forward ${roll} steps.`
      }

      // Check capture if on global track (0..50)
      if (token.step <= 50) {
        const globalIdx = (activePlayer.startIndex + token.step) % 52
        if (!SAFE_STAR_TILES.has(globalIdx)) {
          // Check opponent tokens on same cell
          for (let pIdx = 0; pIdx < this.state.players.length; pIdx++) {
            if (pIdx === this.state.activePlayerIndex) continue
            const opponent = this.state.players[pIdx]
            for (const oppToken of opponent.tokens) {
              if (oppToken.step >= 0 && oppToken.step <= 50) {
                const oppGlobalIdx = (opponent.startIndex + oppToken.step) % 52
                if (oppGlobalIdx === globalIdx) {
                  // Capture! Send oppToken back to yard
                  oppToken.step = -1
                  capturedOpponent = true
                  this.state.lastEvent = `💥 ${activePlayer.name} captured ${opponent.name}'s token!`
                }
              }
            }
          }
        }
      }
    }

    this.state.waitingForTokenSelect = false
    this.state.eligibleTokenIds = []
    this.state.revision++

    // Check win condition: all tokens reached 56
    const allHome = activePlayer.tokens.every((t) => t.step === 56)
    if (allHome) {
      this.state.winnerId = activePlayer.id
      this.state.lastEvent = `👑 ${activePlayer.name} brought all tokens Home and won! 🎉`
      return { state: this.getState(), capturedOpponent, hasWon: true }
    }

    // Advance turn: bonus turn if rolled 6 or captured opponent
    if (roll === 6 || capturedOpponent) {
      this.state.lastEvent += ' Bonus roll awarded! 🎲'
    } else {
      this.state.activePlayerIndex = (this.state.activePlayerIndex + 1) % this.state.players.length
    }

    return { state: this.getState(), capturedOpponent, hasWon: false }
  }
}
