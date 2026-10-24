import type { IncomingMessage, ServerResponse } from 'node:http'
import { AccessToken } from 'livekit-server-sdk'

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>
  url?: string
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

// ponytail: Issue 6h LiveKit room tokens via Vercel Serverless Function
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  let room = 'default-room'
  let username = `meadow-${Math.random().toString(36).slice(2, 7)}`

  if (req.query?.room) {
    room = Array.isArray(req.query.room) ? req.query.room[0] : req.query.room
  } else if (req.url) {
    const url = new URL(req.url, 'http://localhost')
    room = url.searchParams.get('room') || room
  }

  if (req.query?.username) {
    username = Array.isArray(req.query.username) ? req.query.username[0] : req.query.username
  } else if (req.url) {
    const url = new URL(req.url, 'http://localhost')
    username = url.searchParams.get('username') || username
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const livekitUrl = process.env.LIVEKIT_URL

  if (!apiKey || !apiSecret || !livekitUrl) {
    res.status(500).json({
      error: 'LiveKit credentials missing in server environment.',
    })
    return
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
      name: username,
      ttl: '6h',
    })
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
    const token = await at.toJwt()

    res.status(200).json({ token, url: livekitUrl, username })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token signing failed'
    res.status(500).json({ error: message })
  }
}
