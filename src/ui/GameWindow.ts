import {
  SnakesGame,
  type SnakesGameState,
  getTileCoordinates,
  SNAKES_AND_LADDERS,
  GameSoundSynthesizer,
} from '../games/SnakesGame'

export class GameWindow {
  private overlay: HTMLDivElement
  private card: HTMLDivElement
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

  private game: SnakesGame
  private sound: GameSoundSynthesizer
  private isOpen = false
  private localPlayerId = ''
  private isHost = false

  public onRollRequest?: (playerId: string) => void
  public onResetRequest?: () => void
  public onJoinRequest?: (playerId: string, name: string) => void

  constructor(parent: HTMLElement) {
    this.game = new SnakesGame()
    this.sound = new GameSoundSynthesizer()

    this.overlay = document.createElement('div')
    this.overlay.className = 'meadow-game-overlay'

    this.card = document.createElement('div')
    this.card.className = 'meadow-game-card'

    this.card.innerHTML = `
      <div class="game-header">
        <div class="game-title-group">
          <h3 class="game-title">🐍 Meadow Ladders</h3>
          <span class="game-subtitle">Synced Live Parlor</span>
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

    this.boardGrid = this.card.querySelector('#game-board-grid')!
    this.svgLayer = this.card.querySelector('#game-board-svg')!
    this.pawnsContainer = this.card.querySelector('#game-pawns-container')!
    this.turnBanner = this.card.querySelector('#game-turn-banner')!
    this.eventLog = this.card.querySelector('#game-event-log')!
    this.rollBtn = this.card.querySelector('#game-roll-btn')!
    this.diceFace = this.card.querySelector('#game-dice-face')!
    this.resetBtn = this.card.querySelector('#game-reset-btn')!
    this.closeBtn = this.card.querySelector('#game-close-btn')!

    this.renderBoardGrid()
    this.renderBoardVectors()
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

  getGameState(): SnakesGameState {
    return this.game.getState()
  }

  setGameState(state: SnakesGameState): void {
    const prevState = this.game.getState()
    this.game.setState(state)

    // Play audio cues on differences
    if (state.lastRoll && state.lastRoll !== prevState.lastRoll) {
      this.animateDiceRoll(state.lastRoll)
    }

    if (state.winnerId && !prevState.winnerId) {
      this.sound.playVictory()
    }

    this.updateUI()
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
    this.closeBtn.addEventListener('click', () => this.close())
    this.resetBtn.addEventListener('click', () => {
      if (this.onResetRequest) {
        this.onResetRequest()
      } else {
        this.game.resetGame()
        this.updateUI()
      }
    })

    this.rollBtn.addEventListener('click', () => {
      const state = this.game.getState()
      if (state.players.length === 0) return
      const activePlayer = state.players[state.activePlayerIndex]
      if (activePlayer && activePlayer.id !== this.localPlayerId) return

      if (this.onRollRequest) {
        this.onRollRequest(this.localPlayerId)
      } else {
        // Local standalone mode
        const res = this.game.roll(this.localPlayerId)
        this.sound.playDiceRoll()
        if (res.climbedLadder) setTimeout(() => this.sound.playLadderClimb(), 400)
        else if (res.slidSnake) setTimeout(() => this.sound.playSnakeSlide(), 400)
        else if (res.hasWon) setTimeout(() => this.sound.playVictory(), 400)
        else setTimeout(() => this.sound.playPawnStep(activePlayer.position), 300)
        this.setGameState(res.state)
      }
    })
  }

  private renderBoardGrid(): void {
    this.boardGrid.innerHTML = ''
    // 10 rows × 10 cols
    // Grid row 0 is top (tiles 100-91), row 9 is bottom (tiles 1-10)
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
  }

  private renderBoardVectors(): void {
    // Generate SVG curves for snakes and lines with rungs for ladders
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
        // Ladder: two parallel side rails and 3-5 rungs
        const dx = p2.xPercent - p1.xPercent
        const dy = p2.yPercent - p1.yPercent
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len === 0) continue

        // Perpendicular offset for rails
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
        // Snake: sinusoidal bezier curve from head (start) to tail (dest)
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
    const state = this.game.getState()

    // 1. Update Turn Banner & Event Log
    if (state.players.length === 0) {
      this.turnBanner.innerHTML = `<span>Connecting to room parlor...</span>`
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

    if (state.lastEvent) {
      this.eventLog.textContent = state.lastEvent
    }

    // 2. Render Pawns
    this.pawnsContainer.innerHTML = ''
    state.players.forEach((player, idx) => {
      const pawn = document.createElement('div')
      pawn.className = `game-pawn ${player.id === state.players[state.activePlayerIndex]?.id ? 'active' : ''}`
      pawn.style.backgroundColor = player.color
      pawn.title = `${player.name} (Tile ${player.position})`
      pawn.innerHTML = `<span>${player.emoji}</span>`

      // Multi-pawn offset on same tile
      const sameTilePlayers = state.players.filter((p) => p.position === player.position)
      const subIdx = sameTilePlayers.findIndex((p) => p.id === player.id)
      const offset = (subIdx - (sameTilePlayers.length - 1) / 2) * 2.5

      if (player.position === 0) {
        // Bench area at bottom
        pawn.style.left = `${10 + idx * 12}%`
        pawn.style.top = `103%`
      } else {
        const coords = getTileCoordinates(player.position)
        pawn.style.left = `${coords.xPercent + offset}%`
        pawn.style.top = `${coords.yPercent}%`
      }

      this.pawnsContainer.appendChild(pawn)
    })

    // 3. Render Players Roster
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

  dispose(): void {
    this.overlay.remove()
  }
}
