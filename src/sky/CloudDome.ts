import * as THREE from 'three'

export interface CloudDomeOptions {
  /** Share of grid cells that hold a cloud: 0 = clear sky, 1 = packed. */
  coverage?: number
  /** Softness of the cloud edges. */
  softness?: number
  /** Grid scale. Larger values make smaller clouds. */
  scale?: number
  /** Drift speed. */
  speed?: number
  opacity?: number
  shadowColor?: THREE.ColorRepresentation
  lightColor?: THREE.ColorRepresentation
  sunGlowColor?: THREE.ColorRepresentation
}

const vertexShader = /* glsl */ `
varying vec3 vDirection;

void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Cumulus drawn on a grid. Each cell holds at most one cluster of puffs with a
// flat base and a taller crown. Two parallax layers and a faint cirrus veil sit
// behind it. Clouds facing the sun are lit, and a bright fringe appears where
// they cross the sun.
const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uCoverage;
uniform float uSoftness;
uniform float uScale;
uniform float uSpeed;
uniform float uOpacity;
uniform vec3 uSunDir;
uniform vec3 uShadow;
uniform vec3 uLight;
uniform vec3 uGlow;
uniform vec3 uSilver;
uniform vec3 uHaze;
uniform vec2 uWindDir;
varying vec3 vDirection;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  float n = hash21(p);
  return vec2(n, hash21(p + n + 17.0));
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rotate = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = rotate * p;
    amplitude *= 0.5;
  }
  return value;
}

// Cluster coverage (0..1) at a point on the grid. Clusters stay inside their cell.
float clusterMask(vec2 g, float seed) {
  vec2 id = floor(g) + seed;
  vec2 f = fract(g);
  if (hash21(id) > uCoverage) return 0.0;

  vec2 centre = vec2(0.5) + (hash22(id + 3.1) - 0.5) * 0.24;
  float size = mix(0.8, 1.2, hash21(id + 9.7));
  float baseLine = centre.y - 0.1 * size;
  float edge = 0.02 + uSoftness * 0.25;

  float mask = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 o = hash22(id + float(k) * 5.3) - 0.5;
    // Puffs higher in the cluster are a little smaller, which gives the crown shape.
    float height = float(k) * 0.035;
    vec2 p = centre + vec2(o.x * 0.22, o.y * 0.1 + height);
    float r = (0.1 + 0.06 * hash21(id + float(k) * 2.9)) * size * (1.0 - height * 1.5);
    mask = max(mask, 1.0 - smoothstep(r, r + edge, length(f - p)));
  }
  // Flat base: nothing below the cluster's floor.
  mask *= smoothstep(baseLine - 0.01, baseLine + 0.03, f.y);
  return mask;
}

// Returns (alpha, lit, sunFringe) for one layer.
vec3 cloudLayer(vec2 uv, float scale, float speed, float seed, vec2 sunXZ, float sunAmount) {
  vec2 g = uv * scale + uWindDir * (uTime * uSpeed * speed);
  float m0 = clusterMask(g, seed);
  if (m0 <= 0.001) return vec3(0.0);

  vec2 s = normalize(sunXZ + vec2(1e-4));
  float toward1 = clusterMask(g + s * 0.12, seed);
  float toward2 = clusterMask(g + s * 0.3, seed);
  // Cloud material between this point and the sun shades it. A clear path lights it.
  float shadeFromSun = toward1 * 0.7 + toward2 * 0.3;
  float lit = clamp(1.0 - shadeFromSun * 0.8, 0.0, 1.0);
  float fringe = m0 * (1.0 - toward1) * sunAmount;
  return vec3(m0, lit, fringe);
}

vec4 cloudColor(vec3 layer, float haze, float sunAmount, float verticalShade) {
  vec3 body = mix(uShadow, uLight, layer.y * (0.7 + 0.3 * verticalShade));
  body = mix(body, uGlow, sunAmount * 0.25);
  body = mix(body, uSilver, clamp(layer.z * 2.0, 0.0, 1.0));
  body = mix(body, uHaze, haze);
  return vec4(body * layer.x, layer.x);
}

vec4 over(vec4 src, vec4 dst) {
  return src + dst * (1.0 - src.a);
}

void main() {
  vec3 dir = normalize(vDirection);
  if (dir.y <= 0.02) discard;

  vec2 uv = dir.xz / (dir.y + 0.25);
  float sunAmount = pow(max(dot(dir, normalize(uSunDir)), 0.0), 6.0);
  float horizon = smoothstep(0.02, 0.2, dir.y);

  // Far layer: smaller, slower clouds, blended toward the sky colour.
  vec3 farLayer = cloudLayer(uv, uScale * 1.8, 0.6, 40.0, uSunDir.xz, sunAmount);
  vec4 far = cloudColor(farLayer, 0.35, sunAmount, dir.y) * uOpacity * 0.75 * horizon;

  // Near layer: the main cumulus.
  vec3 nearLayer = cloudLayer(uv, uScale, 1.0, 0.0, uSunDir.xz, sunAmount);
  vec4 near = cloudColor(nearLayer, 0.0, sunAmount, dir.y) * uOpacity * horizon;

  // Cirrus veil: thin streaks high in the sky.
  vec2 streak = vec2(uv.x * 0.5, uv.y * 2.6) + uWindDir * (uTime * uSpeed * 0.4);
  float cirrus = smoothstep(0.5, 0.85, fbm(streak)) * smoothstep(0.2, 0.7, dir.y) * 0.3;
  vec4 veil = vec4(uLight * cirrus, cirrus);

  vec4 acc = over(near, over(far, veil));
  if (acc.a <= 0.001) discard;
  gl_FragColor = acc;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/**
 * A sphere that follows the camera and draws cumulus clouds: puffy clusters
 * with flat bases, sun-lit sides, a silver fringe near the sun, two parallax
 * layers and a cirrus veil. Use this instead of the Sky addon's built-in clouds,
 * which are fine-grained noise and do not read as cumulus.
 */
export class CloudDome extends THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  private readonly uniforms: { [name: string]: THREE.IUniform }

  constructor(options: CloudDomeOptions = {}) {
    const uniforms = {
      uTime: { value: 0 },
      uCoverage: { value: options.coverage ?? 0.65 },
      uSoftness: { value: options.softness ?? 0.16 },
      uScale: { value: options.scale ?? 2.2 },
      uSpeed: { value: options.speed ?? 0.01 },
      uOpacity: { value: options.opacity ?? 0.95 },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2).normalize() },
      uShadow: { value: new THREE.Color(options.shadowColor ?? '#cbd9ec') },
      uLight: { value: new THREE.Color(options.lightColor ?? '#ffffff') },
      uGlow: { value: new THREE.Color(options.sunGlowColor ?? '#ffe3a6') },
      uSilver: { value: new THREE.Color('#fff6dc') },
      uHaze: { value: new THREE.Color('#dbe8f5') },
      uWindDir: { value: new THREE.Vector2(0.8, 0.6).normalize() },
    }
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      // The shader returns premultiplied colour, so the blend must match.
      premultipliedAlpha: true,
      depthWrite: false,
      // Keep clouds white in daylight; ACES tone mapping would grey them.
      toneMapped: false,
    })
    super(new THREE.SphereGeometry(4000, 48, 24), material)
    this.uniforms = uniforms
    this.renderOrder = 1
    this.frustumCulled = false
  }

  setSunDirection(direction: THREE.Vector3): void {
    this.uniforms.uSunDir.value.copy(direction)
  }

  setWindDirection(direction: THREE.Vector2): void {
    this.uniforms.uWindDir.value.copy(direction)
  }

  setCoverage(value: number): void {
    this.uniforms.uCoverage.value = value
  }

  setSoftness(value: number): void {
    this.uniforms.uSoftness.value = value
  }

  setScale(value: number): void {
    this.uniforms.uScale.value = value
  }

  setSpeed(value: number): void {
    this.uniforms.uSpeed.value = value
  }

  setOpacity(value: number): void {
    this.uniforms.uOpacity.value = value
  }

  update(camera: THREE.Camera, timeSeconds: number): void {
    this.position.copy(camera.position)
    this.uniforms.uTime.value = timeSeconds
  }
}
