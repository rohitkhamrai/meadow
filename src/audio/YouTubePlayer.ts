declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        config: {
          height?: string | number
          width?: string | number
          videoId?: string
          playerVars?: Record<string, unknown>
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void
            onError?: (event: { data: number }) => void
          }
        },
      ) => YTPlayerInstance
      PlayerState: {
        UNSTARTED: number
        ENDED: number
        PLAYING: number
        PAUSED: number
        BUFFERING: number
        CUED: number
      }
    }
  }
}

export interface YTPlayerInstance {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  loadVideoById: (
    options: string | { videoId: string; startSeconds?: number },
    startSeconds?: number,
  ) => void
  cueVideoById: (
    options: string | { videoId: string; startSeconds?: number },
    startSeconds?: number,
  ) => void
  unMute?: () => void
  mute?: () => void
  setVolume?: (volume: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  getVideoData?: () => { title: string; author: string; video_id: string }
  destroy: () => void
}

// ponytail: Route iOS/Safari WebKit audio session to loud speaker instead of phone call earpiece
export function setAudioSessionMode(mode: 'playback' | 'play-and-record'): void {
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } }
    if (nav.audioSession) {
      nav.audioSession.type = mode
    }
  } catch {}
}

export function extractYouTubeId(urlOrId: string): string | null {
  const ids = extractAllYouTubeIds(urlOrId)
  return ids.length > 0 ? ids[0] : null
}

/** Extracts all YouTube video IDs from text containing single or multiple links/IDs. */
export function extractAllYouTubeIds(input: string): string[] {
  const ids: string[] = []
  const urlRegex =
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.*?&v=|shorts\/))([a-zA-Z0-9_-]{11})/gi
  let match: RegExpExecArray | null
  while ((match = urlRegex.exec(input)) !== null) {
    if (match[1] && !ids.includes(match[1])) {
      ids.push(match[1])
    }
  }
  if (ids.length === 0) {
    const tokens = input.split(/[\s,;\n\r]+/).filter(Boolean)
    for (const token of tokens) {
      if (/^[a-zA-Z0-9_-]{11}$/.test(token) && !ids.includes(token)) {
        ids.push(token)
      }
    }
  }
  return ids
}

export type PlayerStateCallback = (state: 'PLAYING' | 'PAUSED' | 'ENDED' | 'BUFFERING') => void

export class YouTubeController {
  private player?: YTPlayerInstance
  private readyPromise: Promise<void>
  private onStateChangeListeners: PlayerStateCallback[] = []
  private onErrorListeners: ((code: number) => void)[] = []
  private timer?: number
  private currentVideoId?: string
  private currentTitle = 'Whimsical Meadow Tape'
  private volume = 100
  private isMuted = false

  constructor(containerId: string) {
    this.readyPromise = this.initApi(containerId)
  }

  get videoId(): string | undefined {
    return this.currentVideoId
  }

  get title(): string {
    return this.currentTitle
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(100, Math.round(vol)))
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false
      try {
        this.player?.unMute?.()
      } catch {}
    }
    try {
      this.player?.setVolume?.(this.volume)
    } catch {}
  }

  getVolume(): number {
    return this.volume
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted
    try {
      if (this.isMuted) {
        this.player?.mute?.()
      } else {
        this.player?.unMute?.()
        this.player?.setVolume?.(this.volume)
      }
    } catch {}
    return this.isMuted
  }

  getIsMuted(): boolean {
    return this.isMuted
  }

  private enforceAudioRouting(): void {
    setAudioSessionMode('playback')
    try {
      if (!this.isMuted) {
        this.player?.unMute?.()
        this.player?.setVolume?.(this.volume)
      }
    } catch {}
  }

  onStateChange(listener: PlayerStateCallback): () => void {
    this.onStateChangeListeners.push(listener)
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter((l) => l !== listener)
    }
  }

  onError(listener: (code: number) => void): () => void {
    this.onErrorListeners.push(listener)
    return () => {
      this.onErrorListeners = this.onErrorListeners.filter((l) => l !== listener)
    }
  }

  async loadTrack(videoId: string, startSeconds = 0, autoPlay = true): Promise<void> {
    await this.readyPromise
    this.currentVideoId = videoId
    if (!this.player) return

    this.enforceAudioRouting()

    // ponytail: Pass videoId directly as string, avoiding mobile iframe object-parsing error 100
    if (autoPlay && typeof this.player.loadVideoById === 'function') {
      this.player.loadVideoById(videoId, startSeconds)
    } else if (!autoPlay && typeof this.player.cueVideoById === 'function') {
      this.player.cueVideoById(videoId, startSeconds)
    } else {
      if (typeof this.player.seekTo === 'function') {
        this.player.seekTo(startSeconds, true)
      }
      if (autoPlay && typeof this.player.playVideo === 'function') {
        this.player.playVideo()
      }
    }

    // Staggered audio session and volume retries so mobile handshake applies full loudspeaker volume
    setTimeout(() => this.enforceAudioRouting(), 300)
    setTimeout(() => this.enforceAudioRouting(), 1000)

    // Update title once metadata is retrieved
    const fetchTitle = () => {
      const data = this.player?.getVideoData?.()
      if (data?.title) {
        this.currentTitle = data.title
      }
    }
    setTimeout(fetchTitle, 800)
    setTimeout(fetchTitle, 2200)
  }

  async play(): Promise<void> {
    await this.readyPromise
    this.enforceAudioRouting()
    if (typeof this.player?.playVideo === 'function') {
      this.player.playVideo()
    }
    setTimeout(() => this.enforceAudioRouting(), 300)
  }

  async pause(): Promise<void> {
    await this.readyPromise
    if (typeof this.player?.pauseVideo === 'function') {
      this.player.pauseVideo()
    }
  }

  async seekTo(seconds: number): Promise<void> {
    await this.readyPromise
    if (typeof this.player?.seekTo === 'function') {
      this.player.seekTo(seconds, true)
    }
  }

  getCurrentTime(): number {
    return typeof this.player?.getCurrentTime === 'function' ? this.player.getCurrentTime() : 0
  }

  getDuration(): number {
    return typeof this.player?.getDuration === 'function' ? this.player.getDuration() : 0
  }

  isPlaying(): boolean {
    return (
      typeof this.player?.getPlayerState === 'function' &&
      this.player.getPlayerState() === window.YT?.PlayerState.PLAYING
    )
  }

  private initApi(containerId: string): Promise<void> {
    return new Promise((resolve) => {
      const setupPlayer = () => {
        if (!window.YT?.Player) return
        this.player = new window.YT.Player(containerId, {
          height: '160',
          width: '240',
          videoId: '5qap5aO4i9A', // Reliable cozy lofi beat track
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            enablejsapi: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              this.enforceAudioRouting()
              resolve()
            },
            onStateChange: (event) => {
              const yt = window.YT
              if (!yt) return
              let status: 'PLAYING' | 'PAUSED' | 'ENDED' | 'BUFFERING' = 'PAUSED'
              if (event.data === yt.PlayerState.PLAYING) {
                status = 'PLAYING'
                this.enforceAudioRouting()
                const title = this.player?.getVideoData?.()?.title
                if (title) this.currentTitle = title
              } else if (event.data === yt.PlayerState.PAUSED) {
                status = 'PAUSED'
              } else if (event.data === yt.PlayerState.ENDED) {
                status = 'ENDED'
              } else if (event.data === yt.PlayerState.BUFFERING) {
                status = 'BUFFERING'
              }

              for (const listener of this.onStateChangeListeners) {
                listener(status)
              }
            },
            onError: (event) => {
              console.warn('[YouTubePlayer] Playback error code:', event.data)
              for (const listener of this.onErrorListeners) {
                listener(event.data)
              }
            },
          },
        })
      }

      if (window.YT?.Player) {
        setupPlayer()
      } else {
        const existingScript = document.getElementById('youtube-iframe-api')
        if (!existingScript) {
          const tag = document.createElement('script')
          tag.id = 'youtube-iframe-api'
          tag.src = 'https://www.youtube.com/iframe_api'
          document.head.appendChild(tag)
        }
        const previousReady = window.onYouTubeIframeAPIReady
        window.onYouTubeIframeAPIReady = () => {
          previousReady?.()
          setupPlayer()
        }
      }
    })
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer)
    this.player?.destroy()
  }
}
