import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type RemoteTrack,
  type Participant,
} from 'livekit-client'

import type { SnakesGameState } from '../games/SnakesGame'
import type { LudoGameState } from '../games/LudoGame'

export type RoomMessage =
  | { type: 'LOAD_TRACK'; videoId: string; title: string; time: number; isPlaying: boolean }
  | { type: 'PLAY'; time: number }
  | { type: 'PAUSE'; time: number }
  | { type: 'SEEK'; time: number }
  | { type: 'LETTER_UPDATE'; text: string }
  | { type: 'REQUEST_STATE' }
  | { type: 'QUEUE_UPDATE'; queue: string[] }
  | {
      type: 'SYNC_STATE'
      videoId: string
      title: string
      time: number
      isPlaying: boolean
      letterText: string
      queue?: string[]
      gameState?: SnakesGameState
      ludoState?: LudoGameState
    }
  | {
      type: 'GAME_ACTION'
      action:
        | { type: 'ROLL'; playerId: string }
        | { type: 'JOIN'; playerId: string; name: string }
        | { type: 'RESET' }
    }
  | {
      type: 'GAME_STATE_UPDATE'
      state: SnakesGameState
    }
  | {
      type: 'LUDO_ACTION'
      action:
        | { type: 'ROLL'; playerId: string }
        | { type: 'MOVE_TOKEN'; playerId: string; tokenId: number }
        | { type: 'JOIN'; playerId: string; name: string }
        | { type: 'RESET' }
    }
  | {
      type: 'LUDO_STATE_UPDATE'
      state: LudoGameState
    }

export type RoomListener = (message: RoomMessage, isSelf: boolean) => void
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
export type ConnectionStatusListener = (status: ConnectionStatus, errorMsg?: string) => void

export interface LiveKitRoomOptions {
  roomKey?: string
  hostKey?: string
  action?: 'create' | 'join'
}

/**
 * LiveKit SFU Room client: Handles multi-user WebRTC voice chat and low-latency
 * DataChannel synchronization for tape playback, queues, and digital letters.
 */
export class LiveKitRoom {
  readonly roomId: string
  private isHostRole = false
  private roomKey?: string
  private hostKey?: string
  private action: 'create' | 'join'
  private connectionStatus: ConnectionStatus = 'connecting'
  private connectionStatusListeners: ConnectionStatusListener[] = []
  private credentialListeners: ((roomKey: string, hostKey?: string) => void)[] = []
  private room: Room
  private broadcastChannel?: BroadcastChannel
  private listeners: RoomListener[] = []
  private speakerListeners: ((speakingIds: string[]) => void)[] = []
  private participantListeners: ((count: number) => void)[] = []
  private audioElements: Map<string, HTMLAudioElement> = new Map()
  private stateProvider?: () => {
    videoId: string
    title: string
    time: number
    isPlaying: boolean
    letterText: string
    queue?: string[]
    gameState?: SnakesGameState
    ludoState?: LudoGameState
  }

  constructor(roomId: string, options: LiveKitRoomOptions = {}) {
    this.roomId = roomId
    this.roomKey = options.roomKey
    this.hostKey = options.hostKey
    this.action = options.action ?? (options.roomKey ? 'join' : 'create')

    // Fast local tab broadcast fallback
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(`meadow_room_${roomId}`)
      this.broadcastChannel.addEventListener('message', (event) => {
        this.emit(event.data as RoomMessage, false)
      })
    }

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
    })

    this.setupEvents()
    void this.connect()
  }

  get isHost(): boolean {
    return this.isHostRole
  }

  get localParticipantId(): string {
    return this.room.localParticipant?.identity || 'host-player'
  }

  get status(): ConnectionStatus {
    return this.connectionStatus
  }

  private updateStatus(status: ConnectionStatus, errorMsg?: string): void {
    this.connectionStatus = status
    for (const listener of this.connectionStatusListeners) {
      listener(status, errorMsg)
    }
  }

  private setupEvents(): void {
    // 1. Data messages (tape, letter, queue sync via SFU DataChannel)
    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const text = new TextDecoder().decode(payload)
        const msg = JSON.parse(text) as RoomMessage

        let senderIsHost = false
        if (participant?.metadata) {
          try {
            const meta = JSON.parse(participant.metadata)
            senderIsHost = Boolean(meta.isHost)
          } catch {}
        }

        // Host enforcement: playback commands can ONLY be executed if sender is verified host
        if (
          (msg.type === 'LOAD_TRACK' ||
            msg.type === 'PLAY' ||
            msg.type === 'PAUSE' ||
            msg.type === 'SEEK') &&
          !senderIsHost
        ) {
          console.warn(
            `[LiveKit] Ignored playback command (${msg.type}) from non-host participant:`,
            participant?.identity,
          )
          return
        }

        this.emit(msg, false)

        // ponytail: Any peer with active track or queue responds to newcomer state requests
        if (msg.type === 'REQUEST_STATE' && this.stateProvider) {
          const state = this.stateProvider()
          if (state.videoId || (state.queue && state.queue.length > 0) || this.isHostRole) {
            this.broadcast({
              type: 'SYNC_STATE',
              ...state,
            })
          }
        }
      } catch (err) {
        console.warn('[LiveKit] Failed to parse received data:', err)
      }
    })

    // 2. Incoming voice tracks from remote participants
    this.room.on(
      RoomEvent.TrackSubscribed,
      (
        track: RemoteTrack,
        _publication: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach()
          el.dataset.participant = participant.identity
          el.setAttribute('playsinline', 'true')
          el.setAttribute('webkit-playsinline', 'true')
          document.body.appendChild(el)
          this.audioElements.set(participant.identity, el)
        }
      },
    )

    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (
        track: RemoteTrack,
        _publication: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach((el) => el.remove())
          this.audioElements.delete(participant.identity)
        }
      },
    )

    // 3. Active speaker detection
    this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      const activeIds = speakers.map((s) => s.identity)
      for (const cb of this.speakerListeners) {
        cb(activeIds)
      }
    })

    // 4. Participant count tracking
    const updateCount = () => {
      const total = 1 + this.room.remoteParticipants.size
      for (const cb of this.participantListeners) {
        cb(total)
      }
    }
    this.room.on(RoomEvent.ParticipantConnected, updateCount)
    this.room.on(RoomEvent.ParticipantDisconnected, updateCount)
    this.room.on(RoomEvent.Connected, updateCount)
    this.room.on(RoomEvent.Disconnected, () => {
      this.updateStatus('disconnected', 'Disconnected from voice server')
    })
  }

  async connect(): Promise<void> {
    this.updateStatus('connecting')
    try {
      const username = `meadow-${Math.random().toString(36).slice(2, 6)}`
      const params = new URLSearchParams({
        room: this.roomId,
        username,
        action: this.action,
      })
      if (this.roomKey) params.set('key', this.roomKey)
      if (this.hostKey) params.set('hostKey', this.hostKey)

      const res = await fetch(`/api/livekit-token?${params.toString()}`)
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string }
        const msg = errJson.error || `Voice server returned HTTP ${res.status}`
        throw new Error(msg)
      }

      const data = (await res.json()) as {
        token: string
        url: string
        username: string
        isHost: boolean
        roomKey?: string
        hostKey?: string
      }

      this.isHostRole = Boolean(data.isHost)
      if (data.roomKey) this.roomKey = data.roomKey
      if (data.hostKey) this.hostKey = data.hostKey

      for (const cb of this.credentialListeners) {
        cb(data.roomKey || '', data.hostKey)
      }

      await this.room.connect(data.url, data.token)
      this.updateStatus('connected')

      // Request current room state if guest
      if (!this.isHostRole) {
        setTimeout(() => {
          this.broadcast({ type: 'REQUEST_STATE' })
        }, 500)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      console.warn('[LiveKit] Connection error:', message)
      this.updateStatus('error', message)
    }
  }

  onConnectionStatusChange(listener: ConnectionStatusListener): () => void {
    this.connectionStatusListeners.push(listener)
    listener(this.connectionStatus)
    return () => {
      this.connectionStatusListeners = this.connectionStatusListeners.filter((l) => l !== listener)
    }
  }

  onCredentials(listener: (roomKey: string, hostKey?: string) => void): () => void {
    this.credentialListeners.push(listener)
    if (this.roomKey) listener(this.roomKey, this.hostKey)
    return () => {
      this.credentialListeners = this.credentialListeners.filter((l) => l !== listener)
    }
  }

  setStateProvider(
    provider: () => {
      videoId: string
      title: string
      time: number
      isPlaying: boolean
      letterText: string
      queue?: string[]
      gameState?: SnakesGameState
      ludoState?: LudoGameState
    },
  ): void {
    this.stateProvider = provider
  }

  onMessage(listener: RoomListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  onActiveSpeakersChange(listener: (speakerIds: string[]) => void): () => void {
    this.speakerListeners.push(listener)
    return () => {
      this.speakerListeners = this.speakerListeners.filter((l) => l !== listener)
    }
  }

  onParticipantCountChange(listener: (count: number) => void): () => void {
    this.participantListeners.push(listener)
    return () => {
      this.participantListeners = this.participantListeners.filter((l) => l !== listener)
    }
  }

  async toggleMicrophone(): Promise<boolean> {
    if (this.connectionStatus !== 'connected') {
      await this.connect()
    }
    const currentStatus: ConnectionStatus = this.connectionStatus
    if (currentStatus !== 'connected') {
      throw new Error('Cannot toggle mic: Voice chat is offline.')
    }
    const isEnabled = this.room.localParticipant.isMicrophoneEnabled
    await this.room.localParticipant.setMicrophoneEnabled(!isEnabled)
    return !isEnabled
  }

  isMicEnabled(): boolean {
    return this.room.localParticipant.isMicrophoneEnabled
  }

  broadcast(message: RoomMessage): void {
    this.broadcastChannel?.postMessage(message)
    if (this.room.state === 'connected') {
      try {
        const payload = new TextEncoder().encode(JSON.stringify(message))
        this.room.localParticipant.publishData(payload, { reliable: true })
      } catch (err) {
        console.warn('[LiveKit] Publish data error:', err)
      }
    }
  }

  private emit(message: RoomMessage, isSelf: boolean): void {
    for (const listener of this.listeners) {
      listener(message, isSelf)
    }
  }

  dispose(): void {
    this.broadcastChannel?.close()
    for (const el of this.audioElements.values()) {
      el.remove()
    }
    this.audioElements.clear()
    this.room.disconnect()
  }
}
