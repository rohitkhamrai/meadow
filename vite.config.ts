import { defineConfig, loadEnv } from 'vite'
import { AccessToken } from 'livekit-server-sdk'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: './',
    plugins: [
      {
        name: 'livekit-token-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            void (async () => {
              const url = new URL(req.url ?? '', `http://${req.headers.host}`)
              if (url.pathname === '/api/livekit-token') {
                const room = url.searchParams.get('room') || 'default-room'
                const username =
                  url.searchParams.get('username') ||
                  `meadow-${Math.random().toString(36).slice(2, 7)}`
                const action = url.searchParams.get('action')
                const key = url.searchParams.get('key')
                const hostKey = url.searchParams.get('hostKey')
                const password = url.searchParams.get('pass')

                const apiKey = env.LIVEKIT_API_KEY || process.env.LIVEKIT_API_KEY
                const apiSecret = env.LIVEKIT_API_SECRET || process.env.LIVEKIT_API_SECRET
                const livekitUrl = env.LIVEKIT_URL || process.env.LIVEKIT_URL

                if (!apiKey || !apiSecret || !livekitUrl) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: 'LiveKit credentials missing in server environment.',
                    }),
                  )
                  return
                }

                const crypto = await import('node:crypto')
                const computeSecret = (prefix: string, len: number) =>
                  crypto
                    .createHmac('sha256', apiSecret)
                    .update(`${prefix}:${room}`)
                    .digest('hex')
                    .slice(0, len)

                const expectedRoomSecret = computeSecret('room', 12)
                const expectedHostSecret = computeSecret('host', 16)
                const serverPassword = env.ROOM_PASSWORD || process.env.ROOM_PASSWORD

                let isHost = false

                if (action === 'create') {
                  isHost = true
                } else {
                  const isKeyValid = key && key === expectedRoomSecret
                  const isPassValid = password && serverPassword && password === serverPassword

                  if (!isKeyValid && !isPassValid) {
                    res.statusCode = 403
                    res.setHeader('Content-Type', 'application/json')
                    res.end(
                      JSON.stringify({
                        error:
                          'Access denied: Invalid or missing room secret key. Please use the complete room invite link.',
                      }),
                    )
                    return
                  }

                  if (hostKey && hostKey === expectedHostSecret) {
                    isHost = true
                  }
                }

                try {
                  // ponytail: Issue 6h join token signed with LiveKit secret and verified role metadata
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

                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      token,
                      url: livekitUrl,
                      username,
                      isHost,
                      roomKey: expectedRoomSecret,
                      hostKey: isHost ? expectedHostSecret : undefined,
                    }),
                  )
                } catch (err: unknown) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  const message = err instanceof Error ? err.message : 'Token signing failed'
                  res.end(JSON.stringify({ error: message }))
                }
                return
              }
              next()
            })().catch(next)
          })
        },
      },
    ],
  }
})
