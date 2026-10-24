import * as THREE from 'three'
import GUI from 'lil-gui'
import { Sky } from 'three/addons/objects/Sky.js'
import {
  BLADE_WIDTH_CONTROL,
  DENSITY_CONTROL,
  Grass,
  bladeWidthsFromControl,
  densityFromControl,
  type GrassOptions,
} from './grass'
import { LookCamera } from './camera/LookCamera'
import { CloudDome } from './sky/CloudDome'
import { windDirectionVec2 } from './grass/utils'
import { LiveKitRoom, type RoomMessage } from './sync/LiveKitRoom'
import { YouTubeController, setAudioSessionMode } from './audio/YouTubePlayer'
import { CassetteDeck } from './ui/CassetteDeck'
import { DigitalLetterModal } from './ui/DigitalLetterModal'
import './style.css'
import './ui/whimsical.css'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('The demo mount point is missing.')

const BLADE_HEIGHT_CONTROL = {
  min: 0.24,
  max: 2.4,
  default: 1.5,
} as const

const SHADOW_CAMERA_MARGIN = 3
const MIN_SUN_DISTANCE = 16
// Covers terrain relief plus the tallest grass blades.
const SHADOW_VERTICAL_EXTENT = BLADE_HEIGHT_CONTROL.max + 2
const WORLD_UP = new THREE.Vector3(0, 1, 0)

// Lying-down viewpoint: low to the grass, free to look all around 360 degrees.
const VIEW = {
  eyeHeight: 0.55,
  eyeZ: 8.5,
  fov: 55,
  yaw: 0,
  pitchDeg: 20,
  yawRangeDeg: 360,
  pitchMinDeg: -40,
  pitchMaxDeg: 88,
} as const

const FOG_COLOR = '#dce9ec'
const FOG_NEAR = 26
const FOG_FAR = 150

const TERRAIN_CONFIG = {
  width: 20,
  depth: 20,
  segments: 72,
  seed: 17,
  terrainDegree: 0.55,
  groundColor: '#557d24',
} as const

const DEFAULT_GUI_STATE = {
  ...TERRAIN_CONFIG,
  density: 260,
  bladeHeight: 0.85,
  bladeWidth: BLADE_WIDTH_CONTROL.default,
  windStrength: 0.45,
  windDirection: 35,
  brightness: 0.4,
  shadow: false,
  flowerDensity: 1.2,
  flowerMax: 420,
  sunAzimuth: 215,
  sunElevation: 36,
  sunIntensity: 2.6,
  skyTurbidity: 6,
  skyRayleigh: 1.6,
  skyMieCoefficient: 0.005,
  skyMieDirectionalG: 0.7,
  skyExposure: 0.9,
  skyShowSunDisc: true,
  cloudCoverage: 0.7,
  cloudSoftness: 0.16,
  cloudScale: 1.5,
  cloudSpeed: 0.075,
  cloudOpacity: 0.95,
  baseColor: '#4f7c13',
  tipColor: '#b8da57',
} as const

const guiState = { ...DEFAULT_GUI_STATE }
app.classList.add('stage')

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = guiState.skyExposure
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
app.append(renderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR)

const sky = new Sky()
sky.scale.setScalar(10_000)
scene.add(sky)

const skyUniforms = sky.material.uniforms

const camera = new THREE.PerspectiveCamera(
  VIEW.fov,
  window.innerWidth / window.innerHeight,
  0.2,
  10000,
)

const look = new LookCamera(camera, renderer.domElement, {
  yaw: VIEW.yaw,
  pitch: THREE.MathUtils.degToRad(VIEW.pitchDeg),
  yawRange: THREE.MathUtils.degToRad(VIEW.yawRangeDeg),
  pitchMin: THREE.MathUtils.degToRad(VIEW.pitchMinDeg),
  pitchMax: THREE.MathUtils.degToRad(VIEW.pitchMaxDeg),
})

const clouds = new CloudDome({
  coverage: guiState.cloudCoverage,
  softness: guiState.cloudSoftness,
  scale: guiState.cloudScale,
  speed: guiState.cloudSpeed,
  opacity: guiState.cloudOpacity,
})
scene.add(clouds)

const hemi = new THREE.HemisphereLight('#e4f4fb', '#4e6a2c', 1.75)
scene.add(hemi)

const sun = new THREE.DirectionalLight('#fff1c4', DEFAULT_GUI_STATE.sunIntensity)
sun.castShadow = true
sun.shadow.radius = 4
sun.shadow.mapSize.set(4096, 4096)
sun.shadow.bias = -0.00015
sun.shadow.normalBias = 0.04
scene.add(sun)

// Ground that runs out to the horizon, so the meadow never ends in an edge.
const outerGround = new THREE.Mesh(
  new THREE.CircleGeometry(600, 96).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: guiState.groundColor, roughness: 1, metalness: 0 }),
)
outerGround.position.y = -0.45
outerGround.receiveShadow = true
scene.add(outerGround)

const sunDirection = new THREE.Vector3()

const updateShadowCamera = (): void => {
  const shadowCamera = sun.shadow.camera
  const halfWidth = guiState.width * 0.5
  const halfDepth = guiState.depth * 0.5

  const right = new THREE.Vector3().crossVectors(WORLD_UP, sunDirection)
  if (right.lengthSq() > Number.EPSILON) {
    right.normalize()
  } else {
    right.set(1, 0, 0)
  }
  const up = new THREE.Vector3().crossVectors(sunDirection, right).normalize()

  const extentAlong = (axis: THREE.Vector3): number =>
    halfWidth * Math.abs(axis.x) +
    SHADOW_VERTICAL_EXTENT * Math.abs(axis.y) +
    halfDepth * Math.abs(axis.z)
  const rightExtent = extentAlong(right)
  const upExtent = extentAlong(up)
  const depthExtent = extentAlong(sunDirection)

  const sunDistance = Math.max(MIN_SUN_DISTANCE, depthExtent + SHADOW_CAMERA_MARGIN)
  sun.position.copy(sunDirection).multiplyScalar(sunDistance)

  shadowCamera.left = -(rightExtent + SHADOW_CAMERA_MARGIN)
  shadowCamera.right = rightExtent + SHADOW_CAMERA_MARGIN
  shadowCamera.top = upExtent + SHADOW_CAMERA_MARGIN
  shadowCamera.bottom = -(upExtent + SHADOW_CAMERA_MARGIN)
  shadowCamera.near = 0.1
  shadowCamera.far = depthExtent + sunDistance + SHADOW_CAMERA_MARGIN
  shadowCamera.updateProjectionMatrix()
}

const updateSkySettings = (): void => {
  skyUniforms.turbidity.value = guiState.skyTurbidity
  skyUniforms.rayleigh.value = guiState.skyRayleigh
  skyUniforms.mieCoefficient.value = guiState.skyMieCoefficient
  skyUniforms.mieDirectionalG.value = guiState.skyMieDirectionalG
  skyUniforms.showSunDisc.value = Number(guiState.skyShowSunDisc)
  // The Sky addon's own clouds are disabled; CloudDome draws them instead.
  skyUniforms.cloudCoverage.value = 0
  renderer.toneMappingExposure = guiState.skyExposure
}

const updateCloudSettings = (): void => {
  clouds.setCoverage(guiState.cloudCoverage)
  clouds.setSoftness(guiState.cloudSoftness)
  clouds.setScale(guiState.cloudScale)
  clouds.setSpeed(guiState.cloudSpeed)
  clouds.setOpacity(guiState.cloudOpacity)
  clouds.setWindDirection(windDirectionVec2(guiState.windDirection))
}

const updateSun = (): void => {
  const phi = THREE.MathUtils.degToRad(90 - guiState.sunElevation)
  const theta = THREE.MathUtils.degToRad(guiState.sunAzimuth)

  sunDirection.setFromSphericalCoords(1, phi, theta)
  sun.intensity = guiState.sunIntensity
  sun.target.position.set(0, 0, 0)
  sun.target.updateMatrixWorld()
  skyUniforms.sunPosition.value.copy(sunDirection)
  clouds.setSunDirection(sunDirection)
  updateShadowCamera()
}

updateSkySettings()
updateCloudSettings()
updateSun()

const terrainConfigFromControls = () => ({
  ...TERRAIN_CONFIG,
  width: guiState.width,
  depth: guiState.depth,
  segments: guiState.segments,
  seed: guiState.seed,
  terrainDegree: guiState.terrainDegree,
  groundColor: guiState.groundColor,
})

const createMeadow = (): Grass =>
  new Grass({
    terrain: terrainConfigFromControls(),
    grass: {
      density: densityFromControl(guiState.density),
      blade: {
        ...bladeWidthsFromControl(guiState.bladeWidth),
        minHeight: guiState.bladeHeight * 0.47,
        maxHeight: guiState.bladeHeight,
        segments: 4,
        lean: 0.1,
      },
      colors: {
        bottom: guiState.baseColor,
        top: guiState.tipColor,
        backlight: '#c1e54d',
      },
      wind: {
        strength: guiState.windStrength,
        speed: 1.6,
        frequency: 0.65,
        turbulence: 0.35,
        lean: 0.08,
        direction: guiState.windDirection,
      },
      brightness: guiState.brightness,
      shadow: guiState.shadow,
      lighting: {
        direction: new THREE.Vector3(-0.4, 0.85, 0.3),
        color: '#fff5cf',
        intensity: 1.1,
        backlightStrength: 2.5,
        backlightPower: 3,
        backlightTip: 0.6,
      },
    },
    wildflowers: {
      enabled: true,
      density: guiState.flowerDensity,
      maxCount: guiState.flowerMax,
    },
  })

let meadow = createMeadow()
scene.add(meadow)

// Put the eye just above the grass at the spot where the meadow is.
const groundRaycaster = new THREE.Raycaster()
const placeCamera = (): void => {
  groundRaycaster.set(new THREE.Vector3(0, 50, VIEW.eyeZ), new THREE.Vector3(0, -1, 0))
  const hit = meadow.ground ? groundRaycaster.intersectObject(meadow.ground, false)[0] : undefined
  const groundY = hit?.point.y ?? 0
  camera.position.set(0, groundY + VIEW.eyeHeight, VIEW.eyeZ)
}
placeCamera()

const sceneStats = {
  blades: meadow.bladeCount,
  blooms: meadow.wildflowerCount,
}

const syncSceneStats = (): void => {
  sceneStats.blades = meadow.bladeCount
  sceneStats.blooms = meadow.wildflowerCount
}

const rebuildEnvironment = (): void => {
  scene.remove(meadow)
  meadow.dispose()
  meadow = createMeadow()
  scene.add(meadow)
  placeCamera()
  syncSceneStats()
}

const updateMeadow = (patch: GrassOptions): void => {
  meadow.setOptions(patch)
  syncSceneStats()
}

const gui = new GUI({ title: 'Meadow Lab' })
// Start hidden so the view is clean. Press G to show or hide the panel.
let guiShown = false
gui.hide()
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'g') return
  guiShown = !guiShown
  gui.show(guiShown)
})

const resetControls = (): void => {
  Object.assign(guiState, DEFAULT_GUI_STATE)
  updateSkySettings()
  updateCloudSettings()
  updateSun()
  gui.controllersRecursive().forEach((controller) => controller.updateDisplay())
  rebuildEnvironment()
}

const statsFolder = gui.addFolder('Stats').close()
statsFolder.add(sceneStats, 'blades').name('Blades').listen().disable()
statsFolder.add(sceneStats, 'blooms').name('Blooms').listen().disable()

const terrainFolder = gui.addFolder('Terrain')
terrainFolder
  .add(guiState, 'width', 0.1, 100, 0.1)
  .name('Width')
  .onChange((value: number) => {
    updateMeadow({ terrain: { width: value } })
    updateShadowCamera()
  })
terrainFolder
  .add(guiState, 'depth', 0.1, 100, 0.1)
  .name('Depth')
  .onChange((value: number) => {
    updateMeadow({ terrain: { depth: value } })
    updateShadowCamera()
  })
terrainFolder
  .add(guiState, 'segments', 2, 200, 1)
  .name('Segments')
  .onChange((value: number) => {
    updateMeadow({ terrain: { segments: value } })
  })
terrainFolder
  .add(guiState, 'seed', 0, 10_000, 1)
  .name('Seed')
  .onChange((value: number) => {
    updateMeadow({ terrain: { seed: value } })
    placeCamera()
  })
terrainFolder
  .add(guiState, 'terrainDegree', 0, 1, 0.01)
  .name('Degree')
  .onChange((value: number) => {
    updateMeadow({ terrain: { terrainDegree: value } })
    placeCamera()
  })

const grassFolder = gui.addFolder('Grass')
grassFolder
  .add(guiState, 'density', DENSITY_CONTROL.min, DENSITY_CONTROL.max, 1)
  .name('Density')
  .onChange((value: number) => {
    updateMeadow({ grass: { density: densityFromControl(value) } })
  })
grassFolder
  .add(guiState, 'bladeHeight', BLADE_HEIGHT_CONTROL.min, BLADE_HEIGHT_CONTROL.max, 0.02)
  .name('Blade height')
  .onChange((value: number) => {
    updateMeadow({ grass: { blade: { maxHeight: value, minHeight: value * 0.47 } } })
  })
grassFolder
  .add(guiState, 'bladeWidth', BLADE_WIDTH_CONTROL.min, BLADE_WIDTH_CONTROL.max, 0.001)
  .name('Blade width')
  .onChange((value: number) => {
    updateMeadow({ grass: { blade: bladeWidthsFromControl(value) } })
  })
grassFolder
  .add(guiState, 'shadow')
  .name('Shadows')
  .onChange((value: boolean) => {
    updateMeadow({ grass: { shadow: value } })
  })

const flowerFolder = gui.addFolder('Flowers')
flowerFolder
  .add(guiState, 'flowerDensity', 0, 6, 0.05)
  .name('Density')
  .onChange((value: number) => {
    updateMeadow({ wildflowers: { density: value } })
  })
flowerFolder
  .add(guiState, 'flowerMax', 0, 4000, 10)
  .name('Max count')
  .onChange((value: number) => {
    updateMeadow({ wildflowers: { maxCount: value } })
  })

const windFolder = gui.addFolder('Wind')
windFolder
  .add(guiState, 'windStrength', 0, 0.7, 0.01)
  .name('Strength')
  .onChange((value: number) => {
    updateMeadow({ grass: { wind: { strength: value } } })
  })
windFolder
  .add(guiState, 'windDirection', 0, 360, 1)
  .name('Direction')
  .onChange((value: number) => {
    updateMeadow({ grass: { wind: { direction: value } } })
    clouds.setWindDirection(windDirectionVec2(value))
  })

const appearanceFolder = gui.addFolder('Appearance')
appearanceFolder
  .add(guiState, 'brightness', 0.35, 1.7, 0.01)
  .name('Brightness')
  .onChange((value: number) => {
    updateMeadow({ grass: { brightness: value } })
  })
appearanceFolder
  .addColor(guiState, 'groundColor')
  .name('Ground color')
  .onChange((value: string) => {
    updateMeadow({ terrain: { groundColor: value } })
    ;(outerGround.material as THREE.MeshStandardMaterial).color.set(value)
  })
appearanceFolder
  .addColor(guiState, 'baseColor')
  .name('Base color')
  .onChange((value: string) => {
    updateMeadow({ grass: { colors: { bottom: value } } })
  })
appearanceFolder
  .addColor(guiState, 'tipColor')
  .name('Tip color')
  .onChange((value: string) => {
    updateMeadow({ grass: { colors: { top: value } } })
  })

const sunFolder = gui.addFolder('Sun')
sunFolder.add(guiState, 'sunAzimuth', 0, 360, 1).name('Azimuth').onChange(updateSun)
sunFolder.add(guiState, 'sunElevation', 0, 90, 0.1).name('Elevation').onChange(updateSun)
sunFolder.add(guiState, 'sunIntensity', 0, 5, 0.05).name('Intensity').onChange(updateSun)

const skyFolder = gui.addFolder('Sky')
skyFolder.add(guiState, 'skyTurbidity', 0, 20, 0.1).name('Turbidity').onChange(updateSkySettings)
skyFolder.add(guiState, 'skyRayleigh', 0, 4, 0.001).name('Rayleigh').onChange(updateSkySettings)
skyFolder
  .add(guiState, 'skyMieCoefficient', 0, 0.1, 0.001)
  .name('Mie coefficient')
  .onChange(updateSkySettings)
skyFolder
  .add(guiState, 'skyMieDirectionalG', 0, 1, 0.001)
  .name('Mie directional g')
  .onChange(updateSkySettings)
skyFolder.add(guiState, 'skyExposure', 0, 2, 0.0001).name('Exposure').onChange(updateSkySettings)
skyFolder.add(guiState, 'skyShowSunDisc').name('Show sun disc').onChange(updateSkySettings)

const cloudsFolder = gui.addFolder('Clouds')
cloudsFolder
  .add(guiState, 'cloudCoverage', 0, 1, 0.01)
  .name('Coverage')
  .onChange(updateCloudSettings)
cloudsFolder
  .add(guiState, 'cloudSoftness', 0.01, 0.8, 0.01)
  .name('Softness')
  .onChange(updateCloudSettings)
cloudsFolder.add(guiState, 'cloudScale', 0.5, 6, 0.05).name('Size').onChange(updateCloudSettings)
cloudsFolder.add(guiState, 'cloudSpeed', 0, 0.1, 0.001).name('Drift').onChange(updateCloudSettings)
cloudsFolder.add(guiState, 'cloudOpacity', 0, 1, 0.01).name('Opacity').onChange(updateCloudSettings)

gui.add({ reset: resetControls }, 'reset').name('Reset')
syncSceneStats()

// --- Whimsical Listening Room Integration ---
const hash = window.location.hash.slice(1)
const hashParams = new URLSearchParams(hash)
const urlRoom = hashParams.get('room')
const urlKey = hashParams.get('key')

let roomId: string
let roomKey: string | undefined = urlKey || undefined
const action: 'create' | 'join' = urlRoom && urlKey ? 'join' : 'create'

if (urlRoom) {
  roomId = urlRoom
} else {
  roomId = 'iris-' + Math.random().toString(36).slice(2, 8)
}

const savedHostKey = localStorage.getItem(`meadow_host_${roomId}`) || undefined

const roomSync = new LiveKitRoom(roomId, {
  roomKey,
  hostKey: savedHostKey,
  action,
})

const hud = document.createElement('div')
hud.className = 'meadow-hud'
hud.innerHTML = `
  <div class="meadow-hud-badge" id="meadow-room-badge" title="Click to copy invite link or reconnect">
    <span class="dot"></span>
    <span id="room-badge-text">Connecting to #${roomId}...</span>
    <button class="meadow-copy-btn" id="room-copy-btn">Copy Link</button>
  </div>
  <div style="display: flex; gap: 8px; pointer-events: auto;">
    <button class="hud-mic-btn" id="hud-mic-btn" title="Toggle Live Voice Chat">
      <span class="mic-icon">🔇</span>
      <span class="mic-label">Mic Off</span>
    </button>
    <button class="letter-trigger-btn" id="letter-trigger-btn">
      💌 Open Letter
    </button>
  </div>
`
document.body.appendChild(hud)

const ytHost = document.createElement('div')
ytHost.id = 'yt-player-host'
document.body.appendChild(ytHost)

const ytController = new YouTubeController('yt-player-host')
const cassette = new CassetteDeck(document.body)
const letterModal = new DigitalLetterModal(document.body)

roomSync.onCredentials((key, hostKey) => {
  roomKey = key
  if (hostKey) {
    localStorage.setItem(`meadow_host_${roomId}`, hostKey)
  }
  const newHash = `room=${roomId}&key=${key}`
  if (window.location.hash !== `#${newHash}`) {
    history.replaceState(null, '', `#${newHash}`)
  }
})

let currentParticipantCount = 1

function updateBadgeDisplay(status: string, errMessage?: string) {
  const badge = document.getElementById('meadow-room-badge')
  const badgeText = document.getElementById('room-badge-text')
  if (!badgeText || !badge) return

  if (status === 'connected') {
    badge.classList.remove('offline')
    const roleLabel = roomSync.isHost ? 'Host' : 'Guest'
    badgeText.textContent = `Room: #${roomId} (${roleLabel} • ${currentParticipantCount} online)`
  } else if (status === 'connecting') {
    badge.classList.remove('offline')
    badgeText.textContent = `Connecting voice...`
  } else {
    badge.classList.add('offline')
    badgeText.textContent = `⚠️ Voice Offline (${errMessage || 'Click to reconnect'})`
  }
}

roomSync.onConnectionStatusChange((status, err) => {
  updateBadgeDisplay(status, err)
})

roomSync.onParticipantCountChange((count) => {
  currentParticipantCount = count
  updateBadgeDisplay(roomSync.status)
})

const copyBtn = document.getElementById('room-copy-btn')
const copyLink = () => {
  const inviteUrl = `${window.location.origin}${window.location.pathname}#room=${roomId}&key=${roomKey || ''}`
  navigator.clipboard.writeText(inviteUrl).then(() => {
    if (copyBtn) copyBtn.textContent = 'Copied! ✨'
    setTimeout(() => {
      if (copyBtn) copyBtn.textContent = 'Copy Link'
    }, 2000)
  })
}

copyBtn?.addEventListener('click', (e) => {
  e.stopPropagation()
  copyLink()
})

document.getElementById('meadow-room-badge')?.addEventListener('click', () => {
  if (roomSync.status !== 'connected') {
    void roomSync.connect()
  } else {
    copyLink()
  }
})

document.getElementById('letter-trigger-btn')?.addEventListener('click', () => {
  letterModal.toggle()
})

// ponytail: Ensure phone speaker loudspeaker mode is set immediately on launch
setAudioSessionMode('playback')

const micBtn = document.getElementById('hud-mic-btn') as HTMLButtonElement
const micIcon = micBtn.querySelector('.mic-icon')!
const micLabel = micBtn.querySelector('.mic-label')!

micBtn.addEventListener('click', async () => {
  try {
    const isNowOn = await roomSync.toggleMicrophone()
    if (isNowOn) {
      setAudioSessionMode('play-and-record')
      micBtn.classList.add('active')
      micIcon.textContent = '🎙️'
      micLabel.textContent = 'Mic On'
    } else {
      setAudioSessionMode('playback')
      micBtn.classList.remove('active', 'speaking')
      micIcon.textContent = '🔇'
      micLabel.textContent = 'Mic Off'
    }
  } catch (err) {
    console.warn('Microphone error:', err)
    alert(err instanceof Error ? err.message : 'Please allow microphone permissions to speak!')
  }
})

roomSync.onActiveSpeakersChange((speakers) => {
  if (speakers.length > 0 && roomSync.isMicEnabled()) {
    micBtn.classList.add('speaking')
  } else {
    micBtn.classList.remove('speaking')
  }
})

cassette.onVolumeChange = (vol) => {
  ytController.setVolume(vol)
}

cassette.onPlayRequest = () => {
  if (!roomSync.isHost) {
    alert('Only the room host can control master playback. You can add songs to the Queue!')
    return
  }
  ytController.play()
  roomSync.broadcast({ type: 'PLAY', time: ytController.getCurrentTime() })
}

cassette.onPauseRequest = () => {
  if (!roomSync.isHost) {
    alert('Only the room host can pause playback. You can add songs to the Queue!')
    return
  }
  ytController.pause()
  roomSync.broadcast({ type: 'PAUSE', time: ytController.getCurrentTime() })
}

cassette.onSeekRequest = (time: number) => {
  if (!roomSync.isHost) {
    alert('Only the room host can scrub the tape.')
    return
  }
  ytController.seekTo(time)
  roomSync.broadcast({ type: 'SEEK', time })
}

cassette.onLoadTrackRequest = (videoId: string) => {
  if (!roomSync.isHost) {
    cassette.enqueue([videoId])
    return
  }
  ytController.loadTrack(videoId, 0, true)
  cassette.setTrackTitle('Loading tape...')
  roomSync.broadcast({
    type: 'LOAD_TRACK',
    videoId,
    title: ytController.title,
    time: 0,
    isPlaying: true,
  })
}

cassette.onQueueChange = (queue) => {
  roomSync.broadcast({ type: 'QUEUE_UPDATE', queue: [...queue] })
}

let lastSkipTimestamp = 0
const advanceTrack = () => {
  const now = Date.now()
  if (now - lastSkipTimestamp < 2500) return
  lastSkipTimestamp = now
  cassette.skipToNextTrack()
}

cassette.onSkipRequest = () => {
  advanceTrack()
}

ytController.onStateChange((state) => {
  cassette.setPlayingState(state === 'PLAYING')
  cassette.setTrackTitle(ytController.title)
  // ponytail: Auto-advance to next queued track when song ends with race debouncing
  if (state === 'ENDED') {
    advanceTrack()
  }
})

ytController.onError((code) => {
  if (code === 101 || code === 150 || code === 100) {
    cassette.setTrackTitle('Tape restricted, skipping...')
    setTimeout(() => {
      advanceTrack()
    }, 1200)
  }
})

letterModal.onTextChange((text) => {
  roomSync.broadcast({ type: 'LETTER_UPDATE', text })
})

roomSync.setStateProvider(() => ({
  videoId: ytController.videoId ?? '5qap5aO4i9A',
  title: ytController.title,
  time: ytController.getCurrentTime(),
  isPlaying: ytController.isPlaying(),
  letterText: letterModal.text,
  queue: [...cassette.getQueue()],
}))

roomSync.onMessage((msg: RoomMessage) => {
  switch (msg.type) {
    case 'LOAD_TRACK':
      ytController.loadTrack(msg.videoId, msg.time, msg.isPlaying)
      cassette.setTrackTitle(msg.title || 'Whimsical Meadow Tape')
      break
    case 'PLAY':
      ytController.seekTo(msg.time)
      ytController.play()
      break
    case 'PAUSE':
      ytController.seekTo(msg.time)
      ytController.pause()
      break
    case 'SEEK':
      ytController.seekTo(msg.time)
      break
    case 'LETTER_UPDATE':
      letterModal.setText(msg.text)
      break
    case 'QUEUE_UPDATE':
      cassette.setQueue(msg.queue)
      break
    case 'SYNC_STATE':
      if (msg.videoId && msg.videoId !== ytController.videoId) {
        ytController.loadTrack(msg.videoId, msg.time, msg.isPlaying)
        cassette.setTrackTitle(msg.title || 'Whimsical Meadow Tape')
      }
      if (msg.queue) {
        cassette.setQueue(msg.queue)
      }
      letterModal.setText(msg.letterText)
      break
  }
})

renderer.setAnimationLoop((time) => {
  const seconds = time * 0.001
  meadow.syncDirectionalLight(sun)
  meadow.update(seconds)
  clouds.update(camera, seconds)
  look.update(seconds)
  cassette.updateProgress(ytController.getCurrentTime(), ytController.getDuration())
  renderer.render(scene, camera)
})

const resize = (): void => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', resize)

window.addEventListener('beforeunload', () => {
  renderer.setAnimationLoop(null)
  window.removeEventListener('resize', resize)
  look.dispose()
  meadow.dispose()
  gui.destroy()
  roomSync.dispose()
  ytController.dispose()
  cassette.dispose()
  letterModal.dispose()
  renderer.dispose()
})
