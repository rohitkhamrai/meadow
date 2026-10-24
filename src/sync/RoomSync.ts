import { Peer, type DataConnection } from 'peerjs'

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

export type RoomSyncListener = (message: RoomMessage, isSelf: boolean) => void

export class RoomSync {
  readonly roomId: string
  readonly isHost: boolean
  private peer?: Peer
  private connections: DataConnection[] = []
  private broadcastChannel?: BroadcastChannel
  private listeners: RoomSyncListener[] = []
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

    // 1. Same-browser instant sync channel (0ms latency fallback)
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(`meadow_room_${roomId}`)
      this.broadcastChannel.addEventListener('message', (event) => {
        this.emit(event.data as RoomMessage, false)
      })
    }

    // 2. Cross-device WebRTC P2P sync via PeerJS
    this.initPeer()
  }

  setStateProvider(
    provider: () => {
      videoId: string
      title: string
      time: number
      isPlaying: boolean
      letterText: string
    },
  ): void {
    this.stateProvider = provider
  }

  onMessage(listener: RoomSyncListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  broadcast(message: RoomMessage): void {
    // Local tab broadcast
    this.broadcastChannel?.postMessage(message)

    // WebRTC connections broadcast
    for (const connection of this.connections) {
      if (connection.open) {
        connection.send(message)
      }
    }
  }

  private emit(message: RoomMessage, isSelf: boolean): void {
    for (const listener of this.listeners) {
      listener(message, isSelf)
    }
  }

  private initPeer(): void {
    try {
      // Host claims the roomId; guests use random IDs and connect to host
      const peerId = this.isHost
        ? `meadow-host-${this.roomId}`
        : `meadow-guest-${this.roomId}-${Math.random().toString(36).slice(2, 7)}`

      this.peer = new Peer(peerId, {
        debug: 1,
      })

      this.peer.on('open', () => {
        if (!this.isHost) {
          this.connectToHost(`meadow-host-${this.roomId}`)
        }
      })

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn)
      })

      this.peer.on('error', (err) => {
        console.warn('PeerJS status:', err.type)
        // If host ID is already taken, try connecting as guest
        if (this.isHost && err.type === 'unavailable-id') {
          console.info('Room host already registered, connecting as peer...')
          this.connectToHost(`meadow-host-${this.roomId}`)
        }
      })
    } catch (error) {
      console.warn('WebRTC initialization skipped:', error)
    }
  }

  private connectToHost(hostId: string): void {
    if (!this.peer) return
    const conn = this.peer.connect(hostId, { reliable: true })
    this.setupConnection(conn)
  }

  private setupConnection(conn: DataConnection): void {
    conn.on('open', () => {
      this.connections.push(conn)
      if (!this.isHost) {
        conn.send({ type: 'REQUEST_STATE' } satisfies RoomMessage)
      }
    })

    conn.on('data', (data) => {
      const message = data as RoomMessage
      if (message.type === 'REQUEST_STATE' && this.stateProvider) {
        const state = this.stateProvider()
        conn.send({
          type: 'SYNC_STATE',
          ...state,
        } satisfies RoomMessage)
        return
      }
      this.emit(message, false)
    })

    conn.on('close', () => {
      this.connections = this.connections.filter((c) => c !== conn)
    })
  }

  dispose(): void {
    this.broadcastChannel?.close()
    for (const conn of this.connections) {
      conn.close()
    }
    this.peer?.destroy()
  }
}
