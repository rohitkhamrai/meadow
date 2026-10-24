import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type RemoteTrack,
  type Participant,
} from 'livekit-client'

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
    }

export type RoomListener = (message: RoomMessage, isSelf: boolean) => void

/**
 * LiveKit SFU Room client: Handles multi-user WebRTC voice chat and low-latency
 * DataChannel synchronization for tape playback, queues, and digital letters.
 */
export class LiveKitRoom {
  readonly roomId: string
  readonly isHost: boolean
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
  }

  constructor(roomId: string, isHost: boolean) {
    this.roomId = roomId
    this.isHost = isHost

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
    this.init()
  }

  private setupEvents(): void {
    // 1. Data messages (tape, letter, queue sync via SFU DataChannel)
    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload)
        const msg = JSON.parse(text) as RoomMessage
        this.emit(msg, false)

        if (msg.type === 'REQUEST_STATE' && this.isHost && this.stateProvider) {
          const state = this.stateProvider()
          this.broadcast({
            type: 'SYNC_STATE',
            ...state,
          })
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
  }

  private async init(): Promise<void> {
    try {
      const username = `guest-${Math.random().toString(36).slice(2, 6)}`
      const res = await fetch(
        `/api/livekit-token?room=${encodeURIComponent(this.roomId)}&username=${encodeURIComponent(username)}`,
      )
      if (!res.ok) {
        throw new Error(`Token request returned HTTP ${res.status}`)
      }
      const data = await res.json()
      await this.room.connect(data.url, data.token)

      // Request current room state if guest
      if (!this.isHost) {
        setTimeout(() => {
          this.broadcast({ type: 'REQUEST_STATE' })
        }, 500)
      }
    } catch (err) {
      console.warn('[LiveKit] Connection error, operating in local mode:', err)
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
