# 🌸 Meadow

> A cozy, shared 3D listening meadow for friends to listen to music, talk, and write letters together in real time.

![Meadow Cover](./cover.jpeg)

---

## ✨ Features

- 📼 **Retro Cassette Deck**: Authentic tactile tape player with rotating spools, audio seeker, side-label volume control, and mute toggle.
- 🎶 **Multi-Link YouTube Queue**: Paste single or batch YouTube links/shorts (`https://...`), queue upcoming tracks, skip on demand, and auto-advance when tracks end.
- 🎙️ **Real-Time Voice Chat**: Multi-user WebRTC voice chat powered by LiveKit SFU with mic toggle, active speaker indicators, and participant counter.
- 💌 **Synchronized Digital Letter**: Shared interactive letter overlay that updates live across all connected peers.
- 🌾 **Stylized 3D World**: Procedural terrain, wind-reactive instanced grass blades, drifting cloud dome, and blooming wildflowers with low-angle 360° lying-down camera controls.
- 📱 **Mobile Loudspeaker Routing**: Native audio session management (`navigator.audioSession`) ensuring audio plays through full-volume stereo phone speakers instead of quiet call earpieces.
- 🔗 **Instant Room Sharing**: Unique room links (`#room=iris-XXXXXX`) for 1-click invite sharing with zero account signup required.

---

## 🚀 Quick Start

### Prerequisites

- Node.js `^20.19.0 || >=22.12.0`
- `pnpm` (or `npm` / `bun`)

### 1. Clone & Install

```bash
git clone https://github.com/rohitkhamrai/meadow.git
cd meadow
pnpm install
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
LIVEKIT_URL=wss://your-subdomain.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

### 3. Run Locally

```bash
pnpm dev
```

Open the printed URL (e.g., `http://localhost:5173/`). Share the `#room=...` URL with a friend to test live synchronization and voice chat.

---

## 🌐 Deploy to Vercel

Meadow includes built-in Vercel configuration ([`vercel.json`](./vercel.json)) and a serverless token endpoint ([`api/livekit-token.ts`](./api/livekit-token.ts)).

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com/new).
3. Under **Settings → Environment Variables**, add:
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
4. Click **Deploy**.

Every `git push` to `main` automatically triggers a zero-downtime production deployment.

---

## 🛠️ Tech Stack

- **Graphics**: [Three.js](https://threejs.org/) (GLSL Shaders, InstancedMesh, Procedural Terrain, Sky Dome)
- **Audio & Media**: YouTube IFrame API with custom hardware audio session management
- **Real-Time Sync & Voice**: [LiveKit](https://livekit.io/) (WebRTC SFU Audio Tracks & Low-Latency DataChannels)
- **Build Tool**: [Vite](https://vitejs.dev/) & TypeScript
- **Tooling**: [Oxlint](https://oxc.rs/) & [Oxfmt](https://oxc.rs/) for ultra-fast linting and formatting

---

## 📜 Development Commands

| Command      | Description                                          |
| ------------ | ---------------------------------------------------- |
| `pnpm dev`   | Start local Vite development server                  |
| `pnpm build` | Type-check and compile production bundle to `dist/`  |
| `pnpm test`  | Run Vitest unit test suite                           |
| `pnpm lint`  | Run Oxlint linter                                    |
| `pnpm fmt`   | Format all source files with Oxfmt                   |
| `pnpm check` | Run lint, format check, tests, and build in sequence |

---

## 📄 License

MIT License. Designed with care for cozy shared moments.
