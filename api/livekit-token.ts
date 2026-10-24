import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHmac } from 'node:crypto'
import { AccessToken } from 'livekit-server-sdk'

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>
  url?: string
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

function computeSecret(secret: string, prefix: string, room: string, length: number): string {
  return createHmac('sha256', secret).update(`${prefix}:${room}`).digest('hex').slice(0, length)
}

// ponytail: Issue authenticated LiveKit room tokens with stateless HMAC room keys & host role checks
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const query = req.query || {}
  const getParam = (name: string): string | null => {
    const val = query[name]
    if (val) return Array.isArray(val) ? val[0] : val
    if (req.url) {
      const parsed = new URL(req.url, 'http://localhost')
      return parsed.searchParams.get(name)
    }
    return null
  }

  const room = getParam('room') || 'default-room'
  const username = getParam('username') || `meadow-${Math.random().toString(36).slice(2, 7)}`
  const action = getParam('action')
  const key = getParam('key')
  const hostKey = getParam('hostKey')
  const password = getParam('pass')

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const livekitUrl = process.env.LIVEKIT_URL

  if (!apiKey || !apiSecret || !livekitUrl) {
    res.status(500).json({
      error: 'LiveKit credentials missing in server environment.',
    })
    return
  }

  const expectedRoomSecret = computeSecret(apiSecret, 'room', room, 12)
  const expectedHostSecret = computeSecret(apiSecret, 'host', room, 16)
  const serverPassword = process.env.ROOM_PASSWORD

  let isHost = false

  if (action === 'create') {
    // Creator initiates a new room -> granted host privileges
    isHost = true
  } else {
    // Joining existing room -> MUST present valid room key or password
    const isKeyValid = key && key === expectedRoomSecret
    const isPassValid = password && serverPassword && password === serverPassword

    if (!isKeyValid && !isPassValid) {
      res.status(403).json({
        error:
          'Access denied: Invalid or missing room secret key. Please use the complete room invite link.',
      })
      return
    }

    if (hostKey && hostKey === expectedHostSecret) {
      isHost = true
    }
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
      name: username,
      ttl: '6h',
      metadata: JSON.stringify({ isHost, room }),
    })
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
    })
    const token = await at.toJwt()

    res.status(200).json({
      token,
      url: livekitUrl,
      username,
      isHost,
      roomKey: expectedRoomSecret,
      hostKey: isHost ? expectedHostSecret : undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token signing failed'
    res.status(500).json({ error: message })
  }
}
