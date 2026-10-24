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

                try {
                  // ponytail: Issue 6h join token signed with LiveKit secret
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

                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ token, url: livekitUrl, username }))
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
