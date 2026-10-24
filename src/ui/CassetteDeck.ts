import { extractAllYouTubeIds } from '../audio/YouTubePlayer'

export class CassetteDeck {
  private element: HTMLDivElement
  private trackTitleEl: HTMLElement
  private playBtn: HTMLButtonElement
  private skipBtn: HTMLButtonElement
  private queuePill: HTMLButtonElement
  private spoolLeft: HTMLElement
  private spoolRight: HTMLElement
  private seeker: HTMLInputElement
  private currentTimeEl: HTMLElement
  private totalTimeEl: HTMLElement
  private urlInput: HTMLInputElement
  private loadBtn: HTMLButtonElement
  private enqueueBtn: HTMLButtonElement
  private queueDrawer: HTMLElement
  private queueItemsContainer: HTMLElement
  private queueNumEl: HTMLElement
  private clearQueueBtn: HTMLButtonElement
  private volBtn: HTMLButtonElement
  private volSlider: HTMLInputElement

  private isDraggingSeeker = false
  private isPlaying = false
  private currentVolume = 100
  private isMuted = false
  private queue: string[] = []

  public onPlayRequest?: () => void
  public onPauseRequest?: () => void
  public onSeekRequest?: (time: number) => void
  public onLoadTrackRequest?: (videoId: string) => void
  public onQueueChange?: (queue: string[]) => void
  public onSkipRequest?: () => void
  public onVolumeChange?: (volume: number) => void

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'cassette-dock'

    this.element.innerHTML = `
      <div class="cassette-minimized-bar" title="Expand tape player">
        <span>🎵</span>
        <span class="cassette-mini-title">Whimsical Meadow Tape</span>
        <span style="font-size: 10px; opacity: 0.7;">▲</span>
      </div>

      <div class="cassette-body">
        <span class="cassette-screw tl"></span>
        <span class="cassette-screw tr"></span>
        <span class="cassette-screw bl"></span>
        <span class="cassette-screw br"></span>
        <button class="cassette-toggle-btn" title="Minimize tape player">✕</button>

        <!-- Label Area -->
        <div class="cassette-label">
          <div class="cassette-title-row">
            <span class="cassette-track-title">Whimsical Meadow Tape</span>
            <div class="cassette-vol-group" title="Tape Volume">
              <button class="cassette-vol-btn" title="Toggle Mute">🔊</button>
              <input type="range" class="cassette-vol-slider" min="0" max="100" value="100" step="1" title="Volume: 100%" />
            </div>
          </div>
        </div>

        <!-- Tape Spool Window -->
        <div class="cassette-window">
          <div class="tape-bridge"></div>
          <div class="cassette-spool left">
            <div class="spool-teeth"></div>
            <div class="spool-center"></div>
          </div>
          <div class="cassette-spool right">
            <div class="spool-teeth"></div>
            <div class="spool-center"></div>
          </div>
        </div>

        <!-- Audio Controls -->
        <div class="cassette-controls">
          <button class="cassette-play-btn" title="Play / Pause">▶</button>
          <button class="cassette-skip-btn" title="Skip to next queued track">⏭</button>
          <div class="cassette-progress-container">
            <input type="range" class="cassette-seeker" min="0" max="100" value="0" step="0.1" />
            <div class="cassette-time-row">
              <span class="cassette-current-time">0:00</span>
              <span class="cassette-total-time">0:00</span>
            </div>
          </div>
          <button class="cassette-queue-pill" title="Toggle Queue List">📼 0</button>
        </div>

        <!-- YouTube Link Input -->
        <div class="cassette-input-row">
          <input
            type="text"
            class="cassette-url-input"
            placeholder="Paste YouTube link(s)..."
          />
          <button class="cassette-load-btn" title="Play first link, queue others">Insert Tape</button>
          <button class="cassette-enqueue-btn" title="Add link(s) to queue">+ Queue</button>
        </div>

        <!-- Mini Queue Drawer -->
        <div class="cassette-queue-drawer hidden">
          <div class="cassette-queue-header">
            <span class="queue-heading">Tape Queue (<span class="queue-num">0</span>)</span>
            <button class="queue-clear-btn" title="Clear entire queue">Clear</button>
          </div>
          <div class="cassette-queue-items"></div>
        </div>
      </div>
    `

    this.trackTitleEl = this.element.querySelector('.cassette-track-title')!
    this.playBtn = this.element.querySelector('.cassette-play-btn')!
    this.skipBtn = this.element.querySelector('.cassette-skip-btn')!
    this.queuePill = this.element.querySelector('.cassette-queue-pill')!
    this.spoolLeft = this.element.querySelector('.cassette-spool.left')!
    this.spoolRight = this.element.querySelector('.cassette-spool.right')!
    this.seeker = this.element.querySelector('.cassette-seeker')!
    this.currentTimeEl = this.element.querySelector('.cassette-current-time')!
    this.totalTimeEl = this.element.querySelector('.cassette-total-time')!
    this.urlInput = this.element.querySelector('.cassette-url-input')!
    this.loadBtn = this.element.querySelector('.cassette-load-btn')!
    this.enqueueBtn = this.element.querySelector('.cassette-enqueue-btn')!
    this.queueDrawer = this.element.querySelector('.cassette-queue-drawer')!
    this.queueItemsContainer = this.element.querySelector('.cassette-queue-items')!
    this.queueNumEl = this.element.querySelector('.queue-num')!
    this.clearQueueBtn = this.element.querySelector('.queue-clear-btn')!
    this.volBtn = this.element.querySelector('.cassette-vol-btn')!
    this.volSlider = this.element.querySelector('.cassette-vol-slider')!

    this.setupEvents()
    this.renderQueue()
    parent.appendChild(this.element)
  }

  private setupEvents(): void {
    this.volSlider.addEventListener('input', () => {
      const vol = parseFloat(this.volSlider.value)
      this.currentVolume = vol
      this.isMuted = vol === 0
      this.updateVolIcon()
      this.onVolumeChange?.(vol)
    })

    this.volBtn.addEventListener('click', () => {
      this.isMuted = !this.isMuted
      if (this.isMuted) {
        this.volSlider.value = '0'
        this.updateVolIcon()
        this.onVolumeChange?.(0)
      } else {
        const restore = this.currentVolume > 0 ? this.currentVolume : 100
        this.currentVolume = restore
        this.volSlider.value = restore.toString()
        this.updateVolIcon()
        this.onVolumeChange?.(restore)
      }
    })

    this.playBtn.addEventListener('click', () => {
      if (this.isPlaying) {
        this.onPauseRequest?.()
      } else {
        this.onPlayRequest?.()
      }
    })

    this.skipBtn.addEventListener('click', () => {
      if (this.queue.length > 0) {
        this.skipToNextTrack()
      } else {
        this.onSkipRequest?.()
      }
    })

    this.queuePill.addEventListener('click', () => {
      this.queueDrawer.classList.toggle('hidden')
    })

    this.clearQueueBtn.addEventListener('click', () => {
      this.clearQueue()
    })

    this.seeker.addEventListener('mousedown', () => {
      this.isDraggingSeeker = true
    })

    this.seeker.addEventListener('change', () => {
      this.isDraggingSeeker = false
      const seekTarget = parseFloat(this.seeker.value)
      this.onSeekRequest?.(seekTarget)
    })

    const handleInsert = () => {
      const input = this.urlInput.value.trim()
      if (!input) return
      const ids = extractAllYouTubeIds(input)
      if (ids.length === 0) {
        alert('Please paste valid YouTube video link(s) or 11-character video ID(s).')
        return
      }
      this.urlInput.value = ''
      // Play first track immediately
      this.onLoadTrackRequest?.(ids[0])
      // Any additional tracks are appended to the queue
      if (ids.length > 1) {
        this.enqueue(ids.slice(1))
        this.queueDrawer.classList.remove('hidden')
      }
    }

    const handleEnqueue = () => {
      const input = this.urlInput.value.trim()
      if (!input) return
      const ids = extractAllYouTubeIds(input)
      if (ids.length === 0) {
        alert('Please paste valid YouTube video link(s) or 11-character video ID(s).')
        return
      }
      this.urlInput.value = ''
      // ponytail: Unconditionally push all links to queue and reveal queue drawer
      this.enqueue(ids)
      this.queueDrawer.classList.remove('hidden')
    }

    const toggleBtn = this.element.querySelector('.cassette-toggle-btn')
    const minimizedBar = this.element.querySelector('.cassette-minimized-bar')

    toggleBtn?.addEventListener('click', () => {
      this.element.classList.add('minimized')
    })

    minimizedBar?.addEventListener('click', () => {
      this.element.classList.remove('minimized')
    })

    this.loadBtn.addEventListener('click', handleInsert)
    this.enqueueBtn.addEventListener('click', handleEnqueue)
    this.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleInsert()
    })
  }

  getQueue(): readonly string[] {
    return this.queue
  }

  setQueue(queue: string[]): void {
    this.queue = [...queue]
    this.renderQueue()
  }

  enqueue(videoIds: string[]): void {
    if (videoIds.length === 0) return
    this.queue.push(...videoIds)
    this.renderQueue()
    this.onQueueChange?.(this.queue)
  }

  skipToNextTrack(): string | undefined {
    if (this.queue.length === 0) return undefined
    const nextId = this.queue.shift()!
    this.renderQueue()
    this.onQueueChange?.(this.queue)
    this.onLoadTrackRequest?.(nextId)
    return nextId
  }

  removeQueueItem(index: number): void {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1)
      this.renderQueue()
      this.onQueueChange?.(this.queue)
    }
  }

  clearQueue(): void {
    this.queue = []
    this.renderQueue()
    this.onQueueChange?.(this.queue)
  }

  private renderQueue(): void {
    const count = this.queue.length
    this.queuePill.textContent = `📼 ${count}`
    this.queueNumEl.textContent = count.toString()

    this.queueItemsContainer.innerHTML = ''
    if (count === 0) {
      this.queueItemsContainer.innerHTML = `<span style="opacity: 0.6; font-style: italic;">No tracks waiting in queue</span>`
      return
    }

    this.queue.forEach((id, idx) => {
      const itemEl = document.createElement('div')
      itemEl.className = 'queue-item'
      itemEl.innerHTML = `
        <span class="queue-item-id">${idx + 1}. ${id}</span>
        <button class="queue-item-remove" title="Remove track">✕</button>
      `
      itemEl.querySelector('.queue-item-remove')?.addEventListener('click', (e) => {
        e.stopPropagation()
        this.removeQueueItem(idx)
      })
      this.queueItemsContainer.appendChild(itemEl)
    })
  }

  setPlayingState(playing: boolean): void {
    this.isPlaying = playing
    this.playBtn.textContent = playing ? '❚❚' : '▶'
    if (playing) {
      this.spoolLeft.classList.add('spinning')
      this.spoolRight.classList.add('spinning')
    } else {
      this.spoolLeft.classList.remove('spinning')
      this.spoolRight.classList.remove('spinning')
    }
  }

  setTrackTitle(title: string): void {
    this.trackTitleEl.textContent = title
    const miniTitle = this.element.querySelector('.cassette-mini-title')
    if (miniTitle) miniTitle.textContent = title
  }

  updateProgress(current: number, duration: number): void {
    if (!this.isDraggingSeeker && duration > 0) {
      this.seeker.max = duration.toString()
      this.seeker.value = current.toString()
    }
    this.currentTimeEl.textContent = this.formatTime(current)
    this.totalTimeEl.textContent = this.formatTime(duration)
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(100, Math.round(volume)))
    this.volSlider.value = this.currentVolume.toString()
    this.isMuted = this.currentVolume === 0
    this.updateVolIcon()
  }

  getVolume(): number {
    return this.currentVolume
  }

  private updateVolIcon(): void {
    if (this.isMuted || this.volSlider.value === '0') {
      this.volBtn.textContent = '🔇'
    } else if (parseFloat(this.volSlider.value) < 50) {
      this.volBtn.textContent = '🔉'
    } else {
      this.volBtn.textContent = '🔊'
    }
    this.volSlider.title = `Volume: ${this.volSlider.value}%`
  }

  dispose(): void {
    this.element.remove()
  }
}
