import {
  SnakesGame,
  type SnakesGameState,
  getTileCoordinates,
  SNAKES_AND_LADDERS,
  GameSoundSynthesizer,
} from '../games/SnakesGame'

import {
  LudoGame,
  type LudoGameState,
  getTokenCoord,
  LUDO_TRACK,
  SAFE_STAR_TILES,
} from '../games/LudoGame'

export class GameWindow {
  private overlay: HTMLDivElement
  private card: HTMLDivElement
  private tabSnakesBtn: HTMLButtonElement
  private tabLudoBtn: HTMLButtonElement
  private boardGrid: HTMLDivElement
  private svgLayer: SVGSVGElement
  private pawnsContainer: HTMLDivElement
  private turnBanner: HTMLDivElement
  private eventLog: HTMLDivElement
  private rollBtn: HTMLButtonElement
  private diceFace: HTMLDivElement
  private resetBtn: HTMLButtonElement
  private closeBtn: HTMLButtonElement
  private minTriggerBtn?: HTMLButtonElement

  private activeTab: 'snakes' | 'ludo' = 'snakes'
  private snakesGame: SnakesGame
  private ludoGame: LudoGame
  private sound: GameSoundSynthesizer
  private isOpen = false
  private localPlayerId = ''
  private isHost = false

  public onRollRequest?: (playerId: string) => void
  public onResetRequest?: () => void
  public onLudoRollRequest?: (playerId: string) => void
  public onLudoMoveTokenRequest?: (playerId: string, tokenId: number) => void
  public onLudoResetRequest?: () => void

  constructor(parent: HTMLElement) {
    this.snakesGame = new SnakesGame()
    this.ludoGame = new LudoGame()
    this.sound = new GameSoundSynthesizer()

    this.overlay = document.createElement('div')
    this.overlay.className = 'meadow-game-overlay'

    this.card = document.createElement('div')
    this.card.className = 'meadow-game-card'

    this.card.innerHTML = `
      <div class="game-header">
        <div class="game-tabs">
          <button class="game-tab-btn active" id="tab-snakes">🐍 Ladders</button>
          <button class="game-tab-btn" id="tab-ludo">🎲 Ludo</button>
        </div>
        <div class="game-header-actions">
          <button class="game-action-btn" id="game-reset-btn" title="Reset Game">🔄 New Game</button>
          <button class="game-close-btn" id="game-close-btn" title="Minimize Games">✕</button>
        </div>
      </div>

      <div class="game-turn-banner" id="game-turn-banner">
        <span>Waiting for players...</span>
      </div>

      <div class="game-board-wrapper">
        <div class="game-board-grid" id="game-board-grid"></div>
        <svg class="game-board-svg" id="game-board-svg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
        <div class="game-pawns-container" id="game-pawns-container"></div>
      </div>

      <div class="game-event-log" id="game-event-log">
        Roll the dice to begin!
      </div>

      <div class="game-controls">
        <div class="game-dice-wrapper">
          <div class="game-dice" id="game-dice-face">
            <span class="dice-pip center"></span>
          </div>
        </div>
        <button class="game-roll-btn" id="game-roll-btn">
          Roll Dice 🎲
        </button>
      </div>

      <div class="game-players-list" id="game-players-list"></div>
    `

    this.overlay.appendChild(this.card)
    parent.appendChild(this.overlay)

    this.tabSnakesBtn = this.card.querySelector('#tab-snakes')!
    this.tabLudoBtn = this.card.querySelector('#tab-ludo')!
    this.boardGrid = this.card.querySelector('#game-board-grid')!
    this.svgLayer = this.card.querySelector('#game-board-svg')!
    this.pawnsContainer = this.card.querySelector('#game-pawns-container')!
    this.turnBanner = this.card.querySelector('#game-turn-banner')!
    this.eventLog = this.card.querySelector('#game-event-log')!
    this.rollBtn = this.card.querySelector('#game-roll-btn')!
    this.diceFace = this.card.querySelector('#game-dice-face')!
    this.resetBtn = this.card.querySelector('#game-reset-btn')!
    this.closeBtn = this.card.querySelector('#game-close-btn')!

    this.renderBoard()
    this.bindEvents()
  }

  setTriggerButton(btn: HTMLButtonElement): void {
    this.minTriggerBtn = btn
  }

  setLocalIdentity(playerId: string, isHost: boolean): void {
    this.localPlayerId = playerId
    this.isHost = isHost
    this.resetBtn.title = this.isHost ? 'Reset Game (Host)' : 'Request Game Reset'
    this.updateUI()
  }

  get host(): boolean {
    return this.isHost
  }

  get currentTab(): 'snakes' | 'ludo' {
    return this.activeTab
  }

  // --- Snakes State API ---
  getGameState(): SnakesGameState {
    return this.snakesGame.getState()
  }

  setGameState(state: SnakesGameState): void {
    const prevState = this.snakesGame.getState()
    this.snakesGame.setState(state)

    if (this.activeTab === 'snakes') {
      if (state.lastRoll && state.lastRoll !== prevState.lastRoll) {
        this.animateDiceRoll(state.lastRoll)
      }
      if (state.winnerId && !prevState.winnerId) {
        this.sound.playVictory()
      }
      this.updateUI()
    }
  }

  // --- Ludo State API ---
  getLudoState(): LudoGameState {
    return this.ludoGame.getState()
  }

  setLudoState(state: LudoGameState): void {
    const prevState = this.ludoGame.getState()
    this.ludoGame.setState(state)

    if (this.activeTab === 'ludo') {
      if (state.lastRoll && state.lastRoll !== prevState.lastRoll) {
        this.animateDiceRoll(state.lastRoll)
      }
      if (state.winnerId && !prevState.winnerId) {
        this.sound.playVictory()
      }
      this.updateUI()
    }
  }

  open(): void {
    this.isOpen = true
    this.overlay.classList.add('open')
    this.minTriggerBtn?.classList.add('active')
    this.updateUI()
  }

  close(): void {
    this.isOpen = false
    this.overlay.classList.remove('open')
    this.minTriggerBtn?.classList.remove('active')
  }

  toggle(): void {
    if (this.isOpen) this.close()
    else this.open()
  }

  private bindEvents(): void {
    this.tabSnakesBtn.addEventListener('click', () => {
      this.activeTab = 'snakes'
      this.tabSnakesBtn.classList.add('active')
      this.tabLudoBtn.classList.remove('active')
      this.renderBoard()
      this.updateUI()
    })

    this.tabLudoBtn.addEventListener('click', () => {
      this.activeTab = 'ludo'
      this.tabLudoBtn.classList.add('active')
      this.tabSnakesBtn.classList.remove('active')
      this.renderBoard()
      this.updateUI()
    })

    this.closeBtn.addEventListener('click', () => this.close())

    this.resetBtn.addEventListener('click', () => {
      if (this.activeTab === 'snakes') {
        if (this.onResetRequest) this.onResetRequest()
        else {
          this.snakesGame.resetGame()
          this.updateUI()
        }
      } else {
        if (this.onLudoResetRequest) this.onLudoResetRequest()
        else {
          this.ludoGame.resetGame()
          this.updateUI()
        }
      }
    })

    this.rollBtn.addEventListener('click', () => {
      if (this.activeTab === 'snakes') {
        const state = this.snakesGame.getState()
        if (state.players.length === 0) return
        const activePlayer = state.players[state.activePlayerIndex]
        if (activePlayer && activePlayer.id !== this.localPlayerId) return

        if (this.onRollRequest) {
          this.onRollRequest(this.localPlayerId)
        } else {
          const res = this.snakesGame.roll(this.localPlayerId)
          this.sound.playDiceRoll()
          if (res.climbedLadder) setTimeout(() => this.sound.playLadderClimb(), 400)
          else if (res.slidSnake) setTimeout(() => this.sound.playSnakeSlide(), 400)
          else if (res.hasWon) setTimeout(() => this.sound.playVictory(), 400)
          else setTimeout(() => this.sound.playPawnStep(activePlayer.position), 300)
          this.setGameState(res.state)
        }
      } else {
        // Ludo roll
        const state = this.ludoGame.getState()
        if (state.players.length === 0) return
        const activePlayer = state.players[state.activePlayerIndex]
        if (activePlayer && activePlayer.id !== this.localPlayerId) return

        if (this.onLudoRollRequest) {
          this.onLudoRollRequest(this.localPlayerId)
        } else {
          const res = this.ludoGame.roll(this.localPlayerId)
          this.sound.playDiceRoll()
          this.setLudoState(res.state)
        }
      }
    })
  }

  private renderBoard(): void {
    if (this.activeTab === 'snakes') {
      this.renderSnakesBoard()
    } else {
      this.renderLudoBoard()
    }
  }

  private renderSnakesBoard(): void {
    this.boardGrid.className = 'game-board-grid snakes-grid'
    this.boardGrid.innerHTML = ''
    for (let r = 9; r >= 0; r--) {
      for (let c = 0; c < 10; c++) {
        const col = r % 2 === 0 ? c : 9 - c
        const tileNum = r * 10 + col + 1
        const cell = document.createElement('div')
        cell.className = `game-board-cell cell-${(r + c) % 2 === 0 ? 'light' : 'dark'}`
        cell.dataset.tile = tileNum.toString()

        let marker = ''
        if (tileNum === 100) marker = '👑 100'
        else if (tileNum === 1) marker = '🌱 START'
        else if (SNAKES_AND_LADDERS[tileNum]) {
          const dest = SNAKES_AND_LADDERS[tileNum]
          marker = dest > tileNum ? `🪜 ${tileNum}` : `🐍 ${tileNum}`
        } else {
          marker = tileNum.toString()
        }

        cell.innerHTML = `<span class="cell-number">${marker}</span>`
        this.boardGrid.appendChild(cell)
      }
    }
    this.renderSnakesVectors()
  }

  private renderSnakesVectors(): void {
    let svgContent = `
      <defs>
        <linearGradient id="ladder-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#b45309" />
        </linearGradient>
        <linearGradient id="snake-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#047857" />
        </linearGradient>
        <filter id="cozy-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="0.8" flood-opacity="0.5"/>
        </filter>
      </defs>
    `

    for (const [startStr, dest] of Object.entries(SNAKES_AND_LADDERS)) {
      const start = Number(startStr)
      const p1 = getTileCoordinates(start)
      const p2 = getTileCoordinates(dest)

      if (dest > start) {
        const dx = p2.xPercent - p1.xPercent
        const dy = p2.yPercent - p1.yPercent
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len === 0) continue

        const offX = (-dy / len) * 1.4
        const offY = (dx / len) * 1.4

        const leftRail = `<line x1="${p1.xPercent + offX}" y1="${p1.yPercent + offY}" x2="${p2.xPercent + offX}" y2="${p2.yPercent + offY}" stroke="url(#ladder-grad)" stroke-width="0.8" stroke-linecap="round" filter="url(#cozy-glow)"/>`
        const rightRail = `<line x1="${p1.xPercent - offX}" y1="${p1.yPercent - offY}" x2="${p2.xPercent - offX}" y2="${p2.yPercent - offY}" stroke="url(#ladder-grad)" stroke-width="0.8" stroke-linecap="round" filter="url(#cozy-glow)"/>`

        let rungs = ''
        const rungCount = Math.max(3, Math.floor(len / 8))
        for (let i = 1; i <= rungCount; i++) {
          const t = i / (rungCount + 1)
          const rx = p1.xPercent + dx * t
          const ry = p1.yPercent + dy * t
          rungs += `<line x1="${rx + offX}" y1="${ry + offY}" x2="${rx - offX}" y2="${ry - offY}" stroke="#fef3c7" stroke-width="0.6" stroke-linecap="round"/>`
        }

        svgContent += leftRail + rightRail + rungs
      } else {
        const midX = (p1.xPercent + p2.xPercent) / 2 + (p1.yPercent > p2.yPercent ? 6 : -6)
        const midY = (p1.yPercent + p2.yPercent) / 2
        const path = `M ${p1.xPercent} ${p1.yPercent} Q ${midX} ${midY} ${p2.xPercent} ${p2.yPercent}`

        svgContent += `
          <path d="${path}" fill="none" stroke="url(#snake-grad)" stroke-width="1.6" stroke-linecap="round" filter="url(#cozy-glow)"/>
          <circle cx="${p1.xPercent}" cy="${p1.yPercent}" r="1.8" fill="#047857" stroke="#34d399" stroke-width="0.5"/>
          <circle cx="${p1.xPercent}" cy="${p1.yPercent}" r="0.6" fill="#fef08a"/>
        `
      }
    }

    this.svgLayer.innerHTML = svgContent
  }

  private renderLudoBoard(): void {
    this.boardGrid.className = 'game-board-grid ludo-grid'
    this.boardGrid.innerHTML = ''
    this.svgLayer.innerHTML = '' // Ludo board is rendered via specialized grid cells

    // 15 rows × 15 cols
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const cell = document.createElement('div')
        cell.className = 'ludo-cell'

        // 1. Quadrant Yards (6x6)
        if (r < 6 && c < 6) {
          cell.classList.add('ludo-yard', 'yard-rose')
          if (r === 2 && (c === 2 || c === 3)) cell.classList.add('yard-nest')
        } else if (r < 6 && c >= 9) {
          cell.classList.add('ludo-yard', 'yard-sage')
          if (r === 2 && (c === 11 || c === 12)) cell.classList.add('yard-nest')
        } else if (r >= 9 && c >= 9) {
          cell.classList.add('ludo-yard', 'yard-buttercup')
          if (r === 11 && (c === 11 || c === 12)) cell.classList.add('yard-nest')
        } else if (r >= 9 && c < 6) {
          cell.classList.add('ludo-yard', 'yard-iris')
          if (r === 11 && (c === 2 || c === 3)) cell.classList.add('yard-nest')
        }
        // 2. Center Home Triangle (6..8, 6..8)
        else if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
          cell.classList.add('ludo-home-triangle')
          if (r === 7 && c === 7) cell.innerHTML = '👑'
        }
        // 3. Home Runways
        else if (r === 7 && c >= 1 && c <= 5) {
          cell.classList.add('ludo-runway', 'runway-rose')
        } else if (c === 7 && r >= 1 && r <= 5) {
          cell.classList.add('ludo-runway', 'runway-sage')
        } else if (r === 7 && c >= 9 && c <= 13) {
          cell.classList.add('ludo-runway', 'runway-buttercup')
        } else if (c === 7 && r >= 9 && r <= 13) {
          cell.classList.add('ludo-runway', 'runway-iris')
        }
        // 4. Track Cells
        else {
          cell.classList.add('ludo-track-cell')
          const trackIdx = LUDO_TRACK.findIndex((coord) => coord.col === c && coord.row === r)
          if (trackIdx !== -1) {
            if (SAFE_STAR_TILES.has(trackIdx)) {
              cell.classList.add('ludo-safe-star')
              cell.innerHTML = '★'
            }
          }
        }

        this.boardGrid.appendChild(cell)
      }
    }
  }

  private animateDiceRoll(roll: number): void {
    this.diceFace.classList.add('rolling')
    setTimeout(() => {
      this.diceFace.classList.remove('rolling')
      this.renderDicePips(roll)
    }, 450)
  }

  private renderDicePips(value: number): void {
    const pipMap: Record<number, string> = {
      1: '<span class="dice-pip center"></span>',
      2: '<span class="dice-pip top-left"></span><span class="dice-pip bottom-right"></span>',
      3: '<span class="dice-pip top-left"></span><span class="dice-pip center"></span><span class="dice-pip bottom-right"></span>',
      4: '<span class="dice-pip top-left"></span><span class="dice-pip top-right"></span><span class="dice-pip bottom-left"></span><span class="dice-pip bottom-right"></span>',
      5: '<span class="dice-pip top-left"></span><span class="dice-pip top-right"></span><span class="dice-pip center"></span><span class="dice-pip bottom-left"></span><span class="dice-pip bottom-right"></span>',
      6: '<span class="dice-pip top-left"></span><span class="dice-pip top-right"></span><span class="dice-pip mid-left"></span><span class="dice-pip mid-right"></span><span class="dice-pip bottom-left"></span><span class="dice-pip bottom-right"></span>',
    }
    this.diceFace.innerHTML = pipMap[value] || pipMap[1]
  }

  private updateUI(): void {
    if (this.activeTab === 'snakes') {
      this.updateSnakesUI()
    } else {
      this.updateLudoUI()
    }
  }

  private updateSnakesUI(): void {
    const state = this.snakesGame.getState()

    if (state.players.length === 0) {
      this.turnBanner.innerHTML = `<span>Connecting to parlor room...</span>`
      this.rollBtn.disabled = true
    } else if (state.winnerId) {
      const winner = state.players.find((p) => p.id === state.winnerId)
      this.turnBanner.innerHTML = `<span class="winner-crown">👑 ${winner?.name || 'Someone'} Won the Game! 🎉</span>`
      this.rollBtn.disabled = true
    } else {
      const activePlayer = state.players[state.activePlayerIndex]
      const isMyTurn = activePlayer?.id === this.localPlayerId

      if (isMyTurn) {
        this.turnBanner.innerHTML = `<span class="your-turn-pill" style="background: ${activePlayer.color}25; border-color: ${activePlayer.color}; color: #fff;">${activePlayer.emoji} Your Turn — Roll the Dice!</span>`
        this.rollBtn.disabled = false
        this.rollBtn.classList.add('pulse')
      } else {
        this.turnBanner.innerHTML = `<span>${activePlayer?.emoji || '🎲'} ${activePlayer?.name || 'Player'}'s turn...</span>`
        this.rollBtn.disabled = true
        this.rollBtn.classList.remove('pulse')
      }
    }

    if (state.lastEvent) this.eventLog.textContent = state.lastEvent

    // Render Pawns
    this.pawnsContainer.innerHTML = ''
    state.players.forEach((player, idx) => {
      const pawn = document.createElement('div')
      pawn.className = `game-pawn ${player.id === state.players[state.activePlayerIndex]?.id ? 'active' : ''}`
      pawn.style.backgroundColor = player.color
      pawn.title = `${player.name} (Tile ${player.position})`
      pawn.innerHTML = `<span>${player.emoji}</span>`

      const sameTilePlayers = state.players.filter((p) => p.position === player.position)
      const subIdx = sameTilePlayers.findIndex((p) => p.id === player.id)
      const offset = (subIdx - (sameTilePlayers.length - 1) / 2) * 2.5

      if (player.position === 0) {
        pawn.style.left = `${10 + idx * 12}%`
        pawn.style.top = `103%`
      } else {
        const coords = getTileCoordinates(player.position)
        pawn.style.left = `${coords.xPercent + offset}%`
        pawn.style.top = `${coords.yPercent}%`
      }

      this.pawnsContainer.appendChild(pawn)
    })

    // Roster
    const playersList = this.card.querySelector('#game-players-list')
    if (playersList) {
      playersList.innerHTML = state.players
        .map((p, i) => {
          const isActive = i === state.activePlayerIndex
          const isYou = p.id === this.localPlayerId
          return `
            <div class="player-roster-badge ${isActive ? 'active-player' : ''}" style="border-color: ${p.color}">
              <span class="badge-emoji">${p.emoji}</span>
              <span class="badge-name">${p.name} ${isYou ? '(You)' : ''}</span>
              <span class="badge-pos">#${p.position}</span>
            </div>
          `
        })
        .join('')
    }
  }

  private updateLudoUI(): void {
    const state = this.ludoGame.getState()

    if (state.players.length === 0) {
      this.turnBanner.innerHTML = `<span>Connecting to parlor room...</span>`
      this.rollBtn.disabled = true
    } else if (state.winnerId) {
      const winner = state.players.find((p) => p.id === state.winnerId)
      this.turnBanner.innerHTML = `<span class="winner-crown">👑 ${winner?.name || 'Someone'} Won Ludo! 🎉</span>`
      this.rollBtn.disabled = true
    } else {
      const activePlayer = state.players[state.activePlayerIndex]
      const isMyTurn = activePlayer?.id === this.localPlayerId

      if (isMyTurn) {
        if (state.waitingForTokenSelect) {
          this.turnBanner.innerHTML = `<span class="your-turn-pill" style="background: ${activePlayer.color}25; border-color: ${activePlayer.color}; color: #fff;">${activePlayer.emoji} Tap a glowing token to move!</span>`
          this.rollBtn.disabled = true
          this.rollBtn.classList.remove('pulse')
        } else {
          this.turnBanner.innerHTML = `<span class="your-turn-pill" style="background: ${activePlayer.color}25; border-color: ${activePlayer.color}; color: #fff;">${activePlayer.emoji} Your Turn — Roll the Dice!</span>`
          this.rollBtn.disabled = false
          this.rollBtn.classList.add('pulse')
        }
      } else {
        this.turnBanner.innerHTML = `<span>${activePlayer?.emoji || '🎲'} ${activePlayer?.name || 'Player'}'s turn...</span>`
        this.rollBtn.disabled = true
        this.rollBtn.classList.remove('pulse')
      }
    }

    if (state.lastEvent) this.eventLog.textContent = state.lastEvent

    // Render Ludo Tokens
    this.pawnsContainer.innerHTML = ''

    // Collect all tokens with their positions to detect shared cells for clustering
    interface RenderedToken {
      player: (typeof state.players)[0]
      token: (typeof state.players)[0]['tokens'][0]
      coord: { col: number; row: number }
      pIdx: number
    }
    const allTokens: RenderedToken[] = []
    state.players.forEach((player, pIdx) => {
      player.tokens.forEach((token) => {
        allTokens.push({
          player,
          token,
          coord: getTokenCoord(pIdx, token),
          pIdx,
        })
      })
    })

    allTokens.forEach(({ player, token, coord, pIdx }) => {
      const isActivePlayer = pIdx === state.activePlayerIndex
      const isLocalActive = isActivePlayer && player.id === this.localPlayerId
      const isEligible =
        isLocalActive && state.waitingForTokenSelect && state.eligibleTokenIds.includes(token.id)

      // Calculate cluster offset if sharing cell with other tokens
      const cellSharedTokens = allTokens.filter(
        (t) => t.coord.col === coord.col && t.coord.row === coord.row,
      )
      const subIdx = cellSharedTokens.findIndex(
        (t) => t.player.id === player.id && t.token.id === token.id,
      )
      const clusterOffset = (subIdx - (cellSharedTokens.length - 1) / 2) * 2.2

      const pawn = document.createElement('div')
      pawn.className = `game-pawn ludo-pawn pawn-${player.colorName.toLowerCase()} ${isEligible ? 'eligible-token' : ''}`
      pawn.dataset.color = player.colorName

      // 15x15 percentage center + cluster offset
      pawn.style.left = `${(coord.col + 0.5) * (100 / 15) + clusterOffset}%`
      pawn.style.top = `${(coord.row + 0.5) * (100 / 15) + clusterOffset}%`
      pawn.innerHTML = `<span>${player.emoji}</span>`
      pawn.title = `${player.name} Token ${token.id + 1} (${token.step === -1 ? 'In Yard' : token.step === 56 ? 'Finished Home!' : `Step ${token.step}`})`

      if (isEligible) {
        pawn.addEventListener('click', (e) => {
          e.stopPropagation()
          if (this.onLudoMoveTokenRequest) {
            this.onLudoMoveTokenRequest(player.id, token.id)
          } else {
            this.ludoGame.moveToken(player.id, token.id)
            this.updateUI()
          }
        })
      }

      this.pawnsContainer.appendChild(pawn)
    })

    // Roster
    const playersList = this.card.querySelector('#game-players-list')
    if (playersList) {
      playersList.innerHTML = state.players
        .map((p, i) => {
          const isActive = i === state.activePlayerIndex
          const isYou = p.id === this.localPlayerId
          const homeTokens = p.tokens.filter((t) => t.step === 56).length
          return `
            <div class="player-roster-badge ${isActive ? 'active-player' : ''}" style="border-color: ${p.color}">
              <span class="badge-emoji">${p.emoji}</span>
              <span class="badge-name">${p.name} ${isYou ? '(You)' : ''}</span>
              <span class="badge-pos">${homeTokens}/2 Home</span>
            </div>
          `
        })
        .join('')
    }
  }

  dispose(): void {
    this.overlay.remove()
  }
}
