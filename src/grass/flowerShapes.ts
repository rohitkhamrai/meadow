import * as THREE from 'three'

const MASK_TILE_WIDTH = 512
const MASK_HEIGHT = 512
// The mask holds one shape, the iris, so every flower uses the same drawing.
export const MASK_VARIANTS = 1

export type FlowerPalette = {
  petal: THREE.Color
  foliage: THREE.Color
  centre: THREE.Color
}

// Four exact iris colorways from the reference painting:
// 1. Rust Crimson-Red / Burnt-Orange Iris
// 2. Radiant Golden-Yellow Iris
// 3. Soft Blush-Pink / Peach Iris
// 4. Royal / Ultramarine Blue Iris
export const FLOWER_PALETTES: readonly FlowerPalette[] = [
  {
    petal: new THREE.Color('#c7381b'),
    foliage: new THREE.Color('#46782d'),
    centre: new THREE.Color('#f8a619'),
  },
  {
    petal: new THREE.Color('#f7c227'),
    foliage: new THREE.Color('#4a8531'),
    centre: new THREE.Color('#d8740c'),
  },
  {
    petal: new THREE.Color('#f7c8c0'),
    foliage: new THREE.Color('#55804e'),
    centre: new THREE.Color('#f8b835'),
  },
  {
    petal: new THREE.Color('#244cb8'),
    foliage: new THREE.Color('#3f7045'),
    centre: new THREE.Color('#fced5e'),
  },
]

export function createMaskTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
    texture.needsUpdate = true
    return texture
  }

  const canvas = document.createElement('canvas')
  canvas.width = MASK_TILE_WIDTH * MASK_VARIANTS
  canvas.height = MASK_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create the procedural wildflower canvas.')

  context.clearRect(0, 0, canvas.width, canvas.height)
  drawIris(context, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

// The shader mixes the mask channels: red = petal, green = foliage, blue = centre.
// Varying the intensity inside one channel gives shading.
function channelRgb(channel: 'petal' | 'foliage' | 'centre', intensity: number): string {
  const level = Math.round(THREE.MathUtils.clamp(intensity, 0, 1) * 255)
  if (channel === 'petal') return `rgb(${level},0,0)`
  if (channel === 'foliage') return `rgb(0,${level},0)`
  return `rgb(0,0,${level})`
}

function setMaskColor(
  context: CanvasRenderingContext2D,
  channel: 'petal' | 'foliage' | 'centre',
): void {
  context.fillStyle = channelRgb(channel, 1)
  context.strokeStyle = context.fillStyle
}

function drawStem(
  context: CanvasRenderingContext2D,
  points: readonly [number, number][],
  width: number,
): void {
  setMaskColor(context, 'foliage')
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = width
  context.beginPath()
  context.moveTo(points[0][0], points[0][1])
  for (let index = 1; index < points.length; index += 1)
    context.lineTo(points[index][0], points[index][1])
  context.stroke()
}

function drawLeaf(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width = 18,
): void {
  context.save()
  context.translate(x, y)
  context.rotate(angle)
  context.beginPath()
  context.moveTo(0, 0)
  context.quadraticCurveTo(length * 0.35, -width * 0.5, length, 0)
  context.quadraticCurveTo(length * 0.35, width * 0.5, 0, 0)
  const shade = context.createLinearGradient(0, 0, length, 0)
  shade.addColorStop(0, channelRgb('foliage', 0.55))
  shade.addColorStop(1, channelRgb('foliage', 0.9))
  context.fillStyle = shade
  context.fill()
  context.strokeStyle = channelRgb('foliage', 0.38)
  context.lineWidth = 1.8
  context.beginPath()
  context.moveTo(3, 0)
  context.lineTo(length * 0.88, 0)
  context.stroke()
  context.restore()
}

// A petal drawn from its base upward, with a wavy, ruffled outline.
function petalPath(
  context: CanvasRenderingContext2D,
  length: number,
  width: number,
  ruffle: number,
): void {
  const steps = 28
  context.beginPath()
  context.moveTo(0, 0)
  for (let step = 0; step <= steps; step += 1) {
    const s = step / steps
    const ripple = 1 + ruffle * Math.sin(s * Math.PI * 3.5) * 0.22
    const halfWidth = width * Math.pow(Math.sin(Math.PI * Math.min(s * 0.82 + 0.18, 1)), 0.6)
    context.lineTo(halfWidth * ripple, -s * length)
  }
  for (let step = steps; step >= 0; step -= 1) {
    const s = step / steps
    const ripple = 1 + ruffle * Math.cos(s * Math.PI * 3.5) * 0.22
    const halfWidth = width * Math.pow(Math.sin(Math.PI * Math.min(s * 0.82 + 0.18, 1)), 0.6)
    context.lineTo(-halfWidth * ripple, -s * length)
  }
  context.closePath()
}

// A ruffled petal with shading: lighter at top, deeper at base.
function ruffledPetal(
  context: CanvasRenderingContext2D,
  channel: 'petal' | 'centre',
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  ruffle: number,
): void {
  context.save()
  context.translate(x, y)
  context.rotate(angle)
  const gradient = context.createLinearGradient(0, 0, 0, -length)
  gradient.addColorStop(0, channelRgb(channel, 0.6))
  gradient.addColorStop(0.45, channelRgb(channel, 0.95))
  gradient.addColorStop(1, channelRgb(channel, 1))
  context.fillStyle = gradient
  petalPath(context, length, width, ruffle)
  context.fill()
  context.restore()
}

// Painterly radiating veins following petal contour.
function petalVeins(
  context: CanvasRenderingContext2D,
  channel: 'petal' | 'centre',
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
): void {
  context.save()
  context.translate(x, y)
  context.rotate(angle)
  context.strokeStyle = channelRgb(channel, 0.38)
  context.lineWidth = 1.0
  for (const side of [-0.55, -0.25, 0, 0.25, 0.55]) {
    context.beginPath()
    context.moveTo(0, -4)
    context.quadraticCurveTo(side * width * 0.6, -length * 0.5, side * width * 0.88, -length * 0.85)
    context.stroke()
  }
  context.restore()
}

// Bearded iris: 3 upright ruffled standards, 3 cascading drooping falls with a
// radiant golden bearded throat, sword leaves, and an upright side bud.
function drawIris(context: CanvasRenderingContext2D, x: number): void {
  const headX = x + 256
  const headY = 190

  // Sword leaves rising from base
  drawLeaf(context, x + 225, 508, -0.62, 240, 24)
  drawLeaf(context, x + 288, 506, 0.55, 220, 22)
  drawLeaf(context, x + 205, 502, -1.05, 175, 20)
  drawLeaf(context, x + 310, 498, 0.92, 165, 18)

  // Side stalk with an upright bud
  drawStem(
    context,
    [
      [x + 160, 508],
      [x + 148, 420],
      [x + 152, 330],
    ],
    8.0,
  )
  // Calyx / spathe wrapping bud
  setMaskColor(context, 'foliage')
  context.beginPath()
  context.ellipse(x + 152, 328, 12, 24, 0.08, 0, Math.PI * 2)
  context.fill()
  // Tightly curled petal cone emerging from bud
  ruffledPetal(context, 'petal', x + 152, 316, -0.05, 52, 16, 0.12)

  // Main stem rising to iris head
  drawStem(
    context,
    [
      [x + 256, 508],
      [x + 256, 380],
      [headX, 260],
      [headX, headY + 16],
    ],
    12.0,
  )

  // Cascading ruffled falls (lower petals)
  ruffledPetal(context, 'petal', headX - 18, headY + 4, Math.PI + 0.6, 142, 58, 0.18)
  ruffledPetal(context, 'petal', headX + 18, headY + 4, Math.PI - 0.6, 142, 58, 0.18)
  ruffledPetal(context, 'petal', headX, headY + 6, Math.PI, 136, 64, 0.16)
  petalVeins(context, 'petal', headX - 18, headY + 4, Math.PI + 0.6, 142, 58)
  petalVeins(context, 'petal', headX + 18, headY + 4, Math.PI - 0.6, 142, 58)
  petalVeins(context, 'petal', headX, headY + 6, Math.PI, 136, 64)

  // Perianth core connecting petals into one solid bloom
  setMaskColor(context, 'petal')
  context.beginPath()
  context.ellipse(headX, headY + 2, 28, 34, 0, 0, Math.PI * 2)
  context.fill()

  // Luminous bearded throat (centre channel) radiating onto falls
  setMaskColor(context, 'centre')
  context.beginPath()
  context.ellipse(headX, headY + 6, 14, 22, 0, 0, Math.PI * 2)
  context.fill()
  context.lineWidth = 3.6
  for (const offset of [-6, -3, 0, 3, 6]) {
    context.beginPath()
    context.moveTo(headX + offset * 0.7, headY + 4)
    context.quadraticCurveTo(headX + offset * 1.5, headY + 28, headX + offset * 2.0, headY + 54)
    context.stroke()
  }

  // Upright ruffled standards (upper petals forming crown)
  ruffledPetal(context, 'petal', headX - 18, headY - 2, -0.34, 142, 50, 0.18)
  ruffledPetal(context, 'petal', headX + 18, headY - 2, 0.34, 142, 50, 0.18)
  ruffledPetal(context, 'petal', headX, headY - 4, 0, 156, 56, 0.2)
  petalVeins(context, 'petal', headX, headY - 4, 0, 156, 56)
}

interface IrisStyle {
  petalBase: string
  petalMid: string
  petalHighlight: string
  petalVein: string
  throatBase: string
  throatHighlight: string
  budPetal: string
  budSide: 'left' | 'right'
  budY: number
}

const HERO_IRIS_STYLES: readonly IrisStyle[] = [
  // 0: Crimson-Red / Burnt-Orange Iris
  {
    petalBase: '#6d120a',
    petalMid: '#c93318',
    petalHighlight: '#e8582b',
    petalVein: '#5a0d06',
    throatBase: '#ff8000',
    throatHighlight: '#fed330',
    budPetal: '#c93318',
    budSide: 'left',
    budY: 310,
  },
  // 1: Golden-Yellow Iris (tallest crown)
  {
    petalBase: '#b06d04',
    petalMid: '#f7ba1a',
    petalHighlight: '#ffea6d',
    petalVein: '#9e5902',
    throatBase: '#df6e08',
    throatHighlight: '#ffb820',
    budPetal: '#f7ba1a',
    budSide: 'right',
    budY: 290,
  },
  // 2: Soft Blush-Pink / Peach Iris
  {
    petalBase: '#ad636c',
    petalMid: '#f3adb3',
    petalHighlight: '#fde8e5',
    petalVein: '#9c4d56',
    throatBase: '#f79320',
    throatHighlight: '#fed868',
    budPetal: '#f3adb3',
    budSide: 'left',
    budY: 300,
  },
  // 3: Royal / Ultramarine Blue Iris
  {
    petalBase: '#12256c',
    petalMid: '#2753ce',
    petalHighlight: '#5c8ef7',
    petalVein: '#0d1a4d',
    throatBase: '#fed836',
    throatHighlight: '#ffffff', // iconic white starburst throat
    budPetal: '#2753ce',
    budSide: 'right',
    budY: 315,
  },
]

function drawSmoothPetal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  length: number,
  width: number,
  colors: { base: string; mid: string; highlight: string; vein: string },
  ruffleAmount = 0.08,
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)

  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(
    -width * 0.45,
    -length * 0.35,
    -width * (0.65 + ruffleAmount),
    -length * 0.72,
    -width * 0.28,
    -length,
  )
  ctx.bezierCurveTo(
    -width * 0.1,
    -length * 1.05,
    width * 0.1,
    -length * 1.05,
    width * 0.28,
    -length,
  )
  ctx.bezierCurveTo(
    width * (0.65 + ruffleAmount),
    -length * 0.72,
    width * 0.45,
    -length * 0.35,
    0,
    0,
  )
  ctx.closePath()

  const grad = ctx.createLinearGradient(0, 0, 0, -length)
  grad.addColorStop(0, colors.base)
  grad.addColorStop(0.35, colors.mid)
  grad.addColorStop(0.85, colors.highlight)
  grad.addColorStop(1, colors.mid)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.strokeStyle = colors.vein
  ctx.lineWidth = 1.0
  ctx.globalAlpha = 0.35
  for (const spread of [-0.4, -0.2, 0, 0.2, 0.4]) {
    ctx.beginPath()
    ctx.moveTo(0, -6)
    ctx.quadraticCurveTo(
      spread * width * 0.6,
      -length * 0.55,
      spread * width * 0.28,
      -length * 0.95,
    )
    ctx.stroke()
  }

  ctx.strokeStyle = colors.highlight
  ctx.lineWidth = 1.6
  ctx.globalAlpha = 0.55
  ctx.stroke()

  ctx.restore()
}

function drawBeardedThroat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  throatBase: string,
  throatHighlight: string,
): void {
  ctx.save()
  const glow = ctx.createRadialGradient(cx, cy + 12, 2, cx, cy + 18, 28)
  glow.addColorStop(0, throatHighlight)
  glow.addColorStop(0.6, throatBase)
  glow.addColorStop(1, 'rgba(255, 200, 0, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse(cx, cy + 16, 26, 36, 0, 0, Math.PI * 2)
  ctx.fill()

  for (let i = -10; i <= 10; i += 1) {
    const s = i / 10
    const x0 = cx + s * 9
    const y0 = cy + 4
    const x1 = cx + s * 24 + Math.sin(s * 3) * 3
    const y1 = cy + 48 + (1 - Math.abs(s)) * 18

    ctx.strokeStyle = Math.abs(s) < 0.38 ? throatHighlight : throatBase
    ctx.lineWidth = 2.2 - Math.abs(s) * 0.8
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(cx + s * 16, cy + 26, x1, y1)
    ctx.stroke()
  }
  ctx.restore()
}

function drawSwordLeaves(ctx: CanvasRenderingContext2D, cx: number, baseY: number): void {
  const leaves = [
    { startX: cx - 25, endX: cx - 85, endY: baseY - 240, width: 22, curve: -35 },
    { startX: cx + 25, endX: cx + 80, endY: baseY - 225, width: 20, curve: 32 },
    { startX: cx - 45, endX: cx - 130, endY: baseY - 180, width: 18, curve: -50 },
    { startX: cx + 45, endX: cx + 125, endY: baseY - 170, width: 18, curve: 45 },
  ]

  for (const leaf of leaves) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(leaf.startX - leaf.width * 0.5, baseY)
    ctx.quadraticCurveTo(
      (leaf.startX + leaf.endX) * 0.5 + leaf.curve,
      (baseY + leaf.endY) * 0.5,
      leaf.endX,
      leaf.endY,
    )
    ctx.quadraticCurveTo(
      (leaf.startX + leaf.endX) * 0.5 + leaf.curve + leaf.width * 0.3,
      (baseY + leaf.endY) * 0.5 + 10,
      leaf.startX + leaf.width * 0.5,
      baseY,
    )
    ctx.closePath()

    const grad = ctx.createLinearGradient(leaf.startX, baseY, leaf.endX, leaf.endY)
    grad.addColorStop(0, '#2e4c1f')
    grad.addColorStop(0.5, '#44722c')
    grad.addColorStop(1, '#609a3c')
    ctx.fillStyle = grad
    ctx.fill()

    ctx.strokeStyle = '#7ec54c'
    ctx.lineWidth = 1.6
    ctx.globalAlpha = 0.65
    ctx.beginPath()
    ctx.moveTo(leaf.startX, baseY)
    ctx.quadraticCurveTo(
      (leaf.startX + leaf.endX) * 0.5 + leaf.curve,
      (baseY + leaf.endY) * 0.5,
      leaf.endX,
      leaf.endY,
    )
    ctx.stroke()
    ctx.restore()
  }
}

function drawIrisBud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  side: 'left' | 'right',
  budY: number,
  petalColor: string,
): void {
  const dir = side === 'left' ? -1 : 1
  const branchX = cx + dir * 85
  const midX = cx + dir * 65

  ctx.save()
  ctx.strokeStyle = '#43702a'
  ctx.lineWidth = 7.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, baseY - 90)
  ctx.quadraticCurveTo(midX, baseY - 130, branchX, budY + 30)
  ctx.stroke()

  ctx.fillStyle = '#4c7c2f'
  ctx.beginPath()
  ctx.ellipse(branchX, budY + 20, 10, 22, dir * 0.1, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = petalColor
  ctx.beginPath()
  ctx.moveTo(branchX - 7, budY + 12)
  ctx.quadraticCurveTo(branchX, budY - 26, branchX + 3, budY - 32)
  ctx.quadraticCurveTo(branchX + 7, budY - 20, branchX + 7, budY + 12)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawMainStem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  headY: number,
): void {
  ctx.save()
  ctx.strokeStyle = '#426e2a'
  ctx.lineWidth = 10
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, baseY)
  ctx.quadraticCurveTo(cx - 3, (baseY + headY) * 0.5, cx, headY + 20)
  ctx.stroke()

  ctx.strokeStyle = '#689e40'
  ctx.lineWidth = 2.5
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.moveTo(cx + 2, baseY)
  ctx.quadraticCurveTo(cx - 1, (baseY + headY) * 0.5, cx + 2, headY + 20)
  ctx.stroke()
  ctx.restore()
}

export function createHeroIrisTexture(index: number): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const dummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
    dummy.needsUpdate = true
    return dummy as unknown as THREE.CanvasTexture
  }

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Cannot create iris 2D canvas')

  ctx.clearRect(0, 0, 512, 512)

  const style = HERO_IRIS_STYLES[index % HERO_IRIS_STYLES.length]
  const cx = 256
  const baseY = 510
  const headY = 175

  // 1. Sword leaves rising from turf
  drawSwordLeaves(ctx, cx, baseY)

  // 2. Side bud with green spathe
  drawIrisBud(ctx, cx, baseY, style.budSide, style.budY, style.budPetal)

  // 3. Main stem
  drawMainStem(ctx, cx, baseY, headY)

  // 4. Background cascading falls (left and right)
  drawSmoothPetal(
    ctx,
    cx - 16,
    headY + 2,
    Math.PI + 0.65,
    135,
    64,
    {
      base: style.petalBase,
      mid: style.petalMid,
      highlight: style.petalHighlight,
      vein: style.petalVein,
    },
    0.14,
  )

  drawSmoothPetal(
    ctx,
    cx + 16,
    headY + 2,
    Math.PI - 0.65,
    135,
    64,
    {
      base: style.petalBase,
      mid: style.petalMid,
      highlight: style.petalHighlight,
      vein: style.petalVein,
    },
    0.14,
  )

  // 5. Front cascading fall draped forward
  drawSmoothPetal(
    ctx,
    cx,
    headY + 6,
    Math.PI,
    142,
    76,
    {
      base: style.petalBase,
      mid: style.petalMid,
      highlight: style.petalHighlight,
      vein: style.petalVein,
    },
    0.16,
  )

  // Central floral perianth core connecting standards and falls seamlessly
  ctx.save()
  const coreGrad = ctx.createRadialGradient(cx, headY + 4, 4, cx, headY + 4, 38)
  coreGrad.addColorStop(0, style.throatHighlight)
  coreGrad.addColorStop(0.45, style.throatBase)
  coreGrad.addColorStop(0.85, style.petalMid)
  coreGrad.addColorStop(1, style.petalBase)
  ctx.fillStyle = coreGrad
  ctx.beginPath()
  ctx.ellipse(cx, headY + 4, 34, 44, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 6. Luminous bearded throat
  drawBeardedThroat(ctx, cx, headY + 4, style.throatBase, style.throatHighlight)

  // 7. Upright crown standards (left, right, center dome)
  drawSmoothPetal(
    ctx,
    cx - 16,
    headY + 2,
    -0.32,
    144,
    56,
    {
      base: style.petalBase,
      mid: style.petalMid,
      highlight: style.petalHighlight,
      vein: style.petalVein,
    },
    0.12,
  )

  drawSmoothPetal(
    ctx,
    cx + 16,
    headY + 2,
    0.32,
    144,
    56,
    {
      base: style.petalBase,
      mid: style.petalMid,
      highlight: style.petalHighlight,
      vein: style.petalVein,
    },
    0.12,
  )

  drawSmoothPetal(
    ctx,
    cx,
    headY,
    0,
    158,
    64,
    {
      base: style.petalBase,
      mid: style.petalMid,
      highlight: style.petalHighlight,
      vein: style.petalVein,
    },
    0.15,
  )

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}
