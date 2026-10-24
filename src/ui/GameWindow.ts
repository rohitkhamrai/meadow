import {
  SnakesGame,
  type SnakesGameState,
  getTileCoordinates,
  GameSoundSynthesizer,
} from '../games/SnakesGame'

import { LudoGame, type LudoGameState, getTokenCoord } from '../games/LudoGame'

const FACE_TRANSFORMS: Record<number, string> = {
  1: 'rotateX(-20deg) rotateY(30deg)',
  2: 'rotateX(-20deg) rotateY(-90deg)',
  3: 'rotateX(90deg) rotateY(30deg)',
  4: 'rotateX(-90deg) rotateY(30deg)',
  5: 'rotateX(-20deg) rotateY(90deg)',
  6: 'rotateX(-20deg) rotateY(210deg)',
}

export class GameWindow {
  private overlay: HTMLDivElement
  private card: HTMLDivElement
  private tabSnakesBtn: HTMLButtonElement
  private tabLudoBtn: HTMLButtonElement
  private boardWrapper: HTMLDivElement
  private boardGrid: HTMLDivElement
  private svgLayer: SVGSVGElement
  private pawnsContainer: HTMLDivElement
  private emojiToastContainer: HTMLDivElement
  private turnBanner: HTMLDivElement
  private eventLog: HTMLDivElement
  private rollBtn: HTMLButtonElement
  private diceScene: HTMLDivElement
  private diceCube: HTMLDivElement
  private resetBtn: HTMLButtonElement
  private closeBtn: HTMLButtonElement
  private minTriggerBtn?: HTMLButtonElement

  private activeTab: 'snakes' | 'ludo' = 'snakes'
  private snakesGame: SnakesGame
  private ludoGame: LudoGame
  private sound: GameSoundSynthesizer
  private isOpen = false
  private localPlayerId = ''
  private localPlayerName = 'Me'
  private isHost = false

  public onRollRequest?: (playerId: string) => void
  public onResetRequest?: () => void
  public onLudoRollRequest?: (playerId: string) => void
  public onLudoMoveTokenRequest?: (playerId: string, tokenId: number) => void
  public onLudoResetRequest?: () => void
  public onEmojiRequest?: (emoji: string) => void

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

      <div class="game-board-wrapper snakes-mode" id="game-board-wrapper">
        <div class="game-board-grid" id="game-board-grid"></div>
        <svg class="game-board-svg" id="game-board-svg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
        <div class="game-pawns-container" id="game-pawns-container"></div>
        <div class="emoji-toast-container" id="emoji-toast-container"></div>
      </div>

      <div class="game-event-log" id="game-event-log">
        Roll the dice to begin!
      </div>

      <div class="game-controls">
        <div class="dice-scene" id="dice-scene" title="Tap to roll dice">
          <div class="dice-cube" id="dice-cube" style="--df: rotateX(-20deg) rotateY(30deg); transform: rotateX(-20deg) rotateY(30deg);">
            <div class="dice-face face-1"><div class="dot"></div></div>
            <div class="dice-face face-2"><div class="dot"></div><div class="dot"></div></div>
            <div class="dice-face face-3"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
            <div class="dice-face face-4"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
            <div class="dice-face face-5"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
            <div class="dice-face face-6"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
          </div>
        </div>
        <button class="game-roll-btn" id="game-roll-btn">
          Roll Dice 🎲
        </button>
      </div>

      <div class="game-emoji-bar" id="game-emoji-bar">
        <button class="game-emoji-btn" data-emoji="❤️">❤️</button>
        <button class="game-emoji-btn" data-emoji="😂">😂</button>
        <button class="game-emoji-btn" data-emoji="🥺">🥺</button>
        <button class="game-emoji-btn" data-emoji="💩">💩</button>
        <button class="game-emoji-btn" data-emoji="🤬">🤬</button>
        <button class="game-emoji-btn" data-emoji="😭">😭</button>
        <button class="game-emoji-btn" data-emoji="😱">😱</button>
        <button class="game-emoji-btn" data-emoji="🤯">🤯</button>
        <button class="game-emoji-btn" data-emoji="😎">😎</button>
        <button class="game-emoji-btn" data-emoji="🔥">🔥</button>
      </div>

      <div class="game-players-list" id="game-players-list"></div>
    `

    this.overlay.appendChild(this.card)
    parent.appendChild(this.overlay)

    this.tabSnakesBtn = this.card.querySelector('#tab-snakes')!
    this.tabLudoBtn = this.card.querySelector('#tab-ludo')!
    this.boardWrapper = this.card.querySelector('#game-board-wrapper')!
    this.boardGrid = this.card.querySelector('#game-board-grid')!
    this.svgLayer = this.card.querySelector('#game-board-svg')!
    this.pawnsContainer = this.card.querySelector('#game-pawns-container')!
    this.emojiToastContainer = this.card.querySelector('#emoji-toast-container')!
    this.turnBanner = this.card.querySelector('#game-turn-banner')!
    this.eventLog = this.card.querySelector('#game-event-log')!
    this.rollBtn = this.card.querySelector('#game-roll-btn')!
    this.diceScene = this.card.querySelector('#dice-scene')!
    this.diceCube = this.card.querySelector('#dice-cube')!
    this.resetBtn = this.card.querySelector('#game-reset-btn')!
    this.closeBtn = this.card.querySelector('#game-close-btn')!

    this.renderBoard()
    this.bindEvents()
  }

  setTriggerButton(btn: HTMLButtonElement): void {
    this.minTriggerBtn = btn
  }

  setLocalIdentity(playerId: string, isHost: boolean, name?: string): void {
    this.localPlayerId = playerId
    this.isHost = isHost
    if (name) this.localPlayerName = name
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

  public showEmojiToast(emoji: string, senderName: string): void {
    if (!this.emojiToastContainer) return

    const toast = document.createElement('div')
    toast.className = 'emoji-toast'
    toast.style.left = `${15 + Math.random() * 70}%`
    toast.style.top = `${25 + Math.random() * 50}%`

    toast.innerHTML = `
      <span class="emoji-toast-icon">${emoji}</span>
      <span class="emoji-toast-name">${senderName || 'Peer'}</span>
    `

    this.emojiToastContainer.appendChild(toast)
    setTimeout(() => toast.remove(), 2200)
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

    const handleRoll = () => {
      if (this.rollBtn.disabled) return
      if (this.activeTab === 'snakes') {
        const state = this.snakesGame.getState()
        if (state.players.length === 0) return
        const activePlayer = state.players[state.activePlayerIndex]
        if (activePlayer && activePlayer.id !== this.localPlayerId) return

        if (this.onRollRequest) {
          this.onRollRequest(this.localPlayerId)
        } else {
          const res = this.snakesGame.roll(this.localPlayerId)
          this.sound.playDiceRoll('snake')
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
          this.sound.playDiceRoll('ludo')
          this.setLudoState(res.state)
        }
      }
    }

    this.rollBtn.addEventListener('click', handleRoll)
    this.diceScene.addEventListener('click', handleRoll)

    // Emoji Bar
    const emojiBtns = this.card.querySelectorAll<HTMLButtonElement>('.game-emoji-btn')
    emojiBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const emoji = btn.dataset.emoji || btn.textContent || '❤️'
        this.showEmojiToast(emoji, this.localPlayerName)
        if (this.onEmojiRequest) {
          this.onEmojiRequest(emoji)
        }
      })
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
    this.boardWrapper.className = 'game-board-wrapper snakes-mode'
    this.boardGrid.className = 'game-board-grid snakes-grid'
    this.boardGrid.innerHTML = ''
    this.svgLayer.innerHTML = '' // bg.jpg already contains the illustrated snakes and ladders
  }

  private renderLudoBoard(): void {
    this.boardWrapper.className = 'game-board-wrapper ludo-mode'
    this.boardGrid.className = 'game-board-grid ludo-grid'
    this.boardGrid.innerHTML = ''
    this.svgLayer.innerHTML = ''

    // 1. Four corner home cards matching ludo-classic
    // Red (cols 1..6, rows 1..6)
    const cardRed = document.createElement('div')
    cardRed.className = 'ludo-home-card card-red'
    cardRed.innerHTML = `
      <div class="home-inner-box">
        <div class="home-nest nest-red" data-nest="0-0"></div>
        <div class="home-nest nest-red" data-nest="0-1"></div>
        <div class="home-nest nest-red" data-nest="0-2"></div>
        <div class="home-nest nest-red" data-nest="0-3"></div>
      </div>
    `
    this.boardGrid.appendChild(cardRed)

    // Green (cols 10..15, rows 1..6)
    const cardGreen = document.createElement('div')
    cardGreen.className = 'ludo-home-card card-green'
    cardGreen.innerHTML = `
      <div class="home-inner-box">
        <div class="home-nest nest-green" data-nest="1-0"></div>
        <div class="home-nest nest-green" data-nest="1-1"></div>
        <div class="home-nest nest-green" data-nest="1-2"></div>
        <div class="home-nest nest-green" data-nest="1-3"></div>
      </div>
    `
    this.boardGrid.appendChild(cardGreen)

    // Yellow (cols 10..15, rows 10..15)
    const cardYellow = document.createElement('div')
    cardYellow.className = 'ludo-home-card card-yellow'
    cardYellow.innerHTML = `
      <div class="home-inner-box">
        <div class="home-nest nest-yellow" data-nest="2-0"></div>
        <div class="home-nest nest-yellow" data-nest="2-1"></div>
        <div class="home-nest nest-yellow" data-nest="2-2"></div>
        <div class="home-nest nest-yellow" data-nest="2-3"></div>
      </div>
    `
    this.boardGrid.appendChild(cardYellow)

    // Blue (cols 1..6, rows 10..15)
    const cardBlue = document.createElement('div')
    cardBlue.className = 'ludo-home-card card-blue'
    cardBlue.innerHTML = `
      <div class="home-inner-box">
        <div class="home-nest nest-blue" data-nest="3-0"></div>
        <div class="home-nest nest-blue" data-nest="3-1"></div>
        <div class="home-nest nest-blue" data-nest="3-2"></div>
        <div class="home-nest nest-blue" data-nest="3-3"></div>
      </div>
    `
    this.boardGrid.appendChild(cardBlue)

    // 2. Center Win House (cols 7..9, rows 7..9)
    const winHouse = document.createElement('div')
    winHouse.className = 'ludo-win-house'
    winHouse.innerHTML = `
      <div class="win-triangle tri-red"></div>
      <div class="win-triangle tri-green"></div>
      <div class="win-triangle tri-yellow"></div>
      <div class="win-triangle tri-blue"></div>
      <div class="win-trophy">🏆</div>
    `
    this.boardGrid.appendChild(winHouse)

    // 3. Track and Runway cells with explicit CSS grid placement
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Skip corner home bases and center win house
        if ((r < 6 && c < 6) || (r < 6 && c >= 9) || (r >= 9 && c >= 9) || (r >= 9 && c < 6))
          continue
        if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue

        const cell = document.createElement('div')
        cell.className = 'ludo-cell'
        cell.style.gridColumn = String(c + 1)
        cell.style.gridRow = String(r + 1)

        // Runways
        if (r === 7 && c >= 1 && c <= 5) {
          cell.classList.add('f-r')
        } else if (c === 7 && r >= 1 && r <= 5) {
          cell.classList.add('f-g')
        } else if (r === 7 && c >= 9 && c <= 13) {
          cell.classList.add('f-y')
        } else if (c === 7 && r >= 9 && r <= 13) {
          cell.classList.add('f-b')
        }
        // Starts
        else if (r === 6 && c === 1) {
          cell.classList.add('s-r')
          cell.innerHTML = '★'
        } else if (r === 1 && c === 8) {
          cell.classList.add('s-g')
          cell.innerHTML = '★'
        } else if (r === 8 && c === 13) {
          cell.classList.add('s-y')
          cell.innerHTML = '★'
        } else if (r === 13 && c === 6) {
          cell.classList.add('s-b')
          cell.innerHTML = '★'
        }
        // Safe stars: [6, 12], [8, 2], [2, 6], [12, 8]
        else if (
          (r === 6 && c === 12) ||
          (r === 8 && c === 2) ||
          (r === 2 && c === 6) ||
          (r === 12 && c === 8)
        ) {
          cell.classList.add('p', 'safe-star')
          cell.innerHTML = '★'
        } else {
          cell.classList.add('p')
        }

        this.boardGrid.appendChild(cell)
      }
    }
  }

  private animateDiceRoll(roll: number): void {
    if (!this.diceCube) return
    this.sound.playDiceRoll(this.activeTab === 'ludo' ? 'ludo' : 'snake')
    const targetTransform = FACE_TRANSFORMS[roll] || FACE_TRANSFORMS[1]
    this.diceCube.style.setProperty('--df', targetTransform)
    this.diceCube.classList.remove('spinning')
    void this.diceCube.offsetWidth // Trigger reflow for animation restart
    this.diceCube.classList.add('spinning')

    this.diceCube.addEventListener(
      'animationend',
      () => {
        this.diceCube.classList.remove('spinning')
        this.diceCube.style.transform = targetTransform
      },
      { once: true },
    )
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
      this.turnBanner.innerHTML = `<span class="winner-crown">👑 ${winner?.name || 'Someone'} Won Snakes & Ladders! 🎉</span>`
      this.rollBtn.disabled = true
    } else {
      const activePlayer = state.players[state.activePlayerIndex]
      const isMyTurn = activePlayer?.id === this.localPlayerId

      if (isMyTurn) {
        this.turnBanner.innerHTML = `<span class="your-turn-pill" style="background: ${activePlayer.color}25; border-color: ${activePlayer.color}; color: #fff;">${activePlayer.emoji} Your Turn — Roll the Dice!</span>`
        this.rollBtn.disabled = false
      } else {
        this.turnBanner.innerHTML = `<span>${activePlayer?.emoji || '🎲'} ${activePlayer?.name || 'Player'}'s turn...</span>`
        this.rollBtn.disabled = true
      }
    }

    if (state.lastEvent) this.eventLog.textContent = state.lastEvent

    // Render Pawns
    this.pawnsContainer.innerHTML = ''
    state.players.forEach((player, pIdx) => {
      if (player.position === 0) return

      const coords = getTileCoordinates(player.position)
      const pawn = document.createElement('div')
      const isActive = pIdx === state.activePlayerIndex

      pawn.className = `game-pawn ${isActive ? 'active' : ''}`
      pawn.style.backgroundColor = player.color
      pawn.style.left = `${coords.xPercent}%`
      pawn.style.top = `${coords.yPercent}%`
      pawn.innerHTML = `
        <span class="pawn-player-name">${player.name}</span>
        <span>${player.emoji}</span>
      `
      pawn.title = `${player.name} on tile ${player.position}`

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
          this.turnBanner.innerHTML = `<span class="your-turn-pill" style="background: ${activePlayer.color}25; border-color: ${activePlayer.color}; color: #fff;">${activePlayer.emoji} Tap a glowing goti to move!</span>`
          this.rollBtn.disabled = true
        } else {
          this.turnBanner.innerHTML = `<span class="your-turn-pill" style="background: ${activePlayer.color}25; border-color: ${activePlayer.color}; color: #fff;">${activePlayer.emoji} Your Turn — Roll the Dice!</span>`
          this.rollBtn.disabled = false
        }
      } else {
        this.turnBanner.innerHTML = `<span>${activePlayer?.emoji || '🎲'} ${activePlayer?.name || 'Player'}'s turn...</span>`
        this.rollBtn.disabled = true
      }
    }

    if (state.lastEvent) this.eventLog.textContent = state.lastEvent

    // Render Ludo Goties
    this.pawnsContainer.innerHTML = ''

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

    const colorClassMap: Record<string, string> = {
      Rose: 'goti-red',
      Sage: 'goti-green',
      Buttercup: 'goti-yellow',
      Iris: 'goti-blue',
    }

    allTokens.forEach(({ player, token, coord, pIdx }) => {
      const isActivePlayer = pIdx === state.activePlayerIndex
      const isLocalActive = isActivePlayer && player.id === this.localPlayerId
      const isEligible =
        isLocalActive && state.waitingForTokenSelect && state.eligibleTokenIds.includes(token.id)

      const cellSharedTokens = allTokens.filter(
        (t) => t.coord.col === coord.col && t.coord.row === coord.row,
      )
      const subIdx = cellSharedTokens.findIndex(
        (t) => t.player.id === player.id && t.token.id === token.id,
      )
      const clusterOffset =
        cellSharedTokens.length > 1 ? (subIdx - (cellSharedTokens.length - 1) / 2) * 2.2 : 0

      const goti = document.createElement('div')
      const colorCls = colorClassMap[player.colorName] || 'goti-red'
      goti.className = `ludo-goti ${colorCls} ${isEligible ? 'selectable' : ''}`

      // 15x15 percentage center
      goti.style.left = `${(coord.col + 0.5) * (100 / 15) + clusterOffset}%`
      goti.style.top = `${(coord.row + 0.5) * (100 / 15) + clusterOffset}%`
      goti.title = `${player.name} Goti ${token.id + 1} (${token.step === -1 ? 'In Yard' : token.step === 56 ? 'Finished Home!' : `Step ${token.step}`})`

      // Badge if multiple tokens occupy the cell and this is the top token
      if (cellSharedTokens.length > 1 && subIdx === cellSharedTokens.length - 1) {
        const badge = document.createElement('span')
        badge.className = 'stack-badge'
        badge.textContent = String(cellSharedTokens.length)
        goti.appendChild(badge)
      }

      if (isEligible) {
        goti.addEventListener('click', (e) => {
          e.stopPropagation()
          if (this.onLudoMoveTokenRequest) {
            this.onLudoMoveTokenRequest(player.id, token.id)
          } else {
            this.ludoGame.moveToken(player.id, token.id)
            this.updateUI()
          }
        })
      }

      this.pawnsContainer.appendChild(goti)
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
