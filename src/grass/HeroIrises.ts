import * as THREE from 'three'
import { createHeroIrisTexture } from './flowerShapes'
import { windDirectionVec2 } from './utils'

export interface HeroIrisesOptions {
  windDirection?: number
  windStrength?: number
  windSpeed?: number
}

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindFrequency;
uniform float uWindTurbulence;
uniform float uWindLean;
uniform vec2 uWindDirection;

varying vec2 vUv;

void main() {
  vUv = uv;

  vec3 transformed = position;
  float bladeHeight = uv.y;
  
  // World space wind wave
  vec3 worldRoot = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float primaryWave = sin(dot(worldRoot.xz, uWindDirection) * uWindFrequency + uTime * uWindSpeed);
  vec2 perpendicular = vec2(-uWindDirection.y, uWindDirection.x);
  float secondaryWave = sin(dot(worldRoot.xz, perpendicular) * uWindFrequency * 1.6 + uTime * uWindSpeed * 0.75) * uWindTurbulence;
  vec3 worldWind = vec3(uWindDirection.x, 0.0, uWindDirection.y) * ((primaryWave + secondaryWave) * uWindStrength + uWindLean);

  vec3 axisX = normalize(vec3(modelMatrix[0]));
  vec3 axisY = normalize(vec3(modelMatrix[1]));
  vec3 axisZ = normalize(vec3(modelMatrix[2]));
  vec3 localWind = vec3(
    dot(worldWind, axisX),
    dot(worldWind, axisY),
    dot(worldWind, axisZ)
  );

  float tipMask = bladeHeight * bladeHeight;
  transformed += localWind * tipMask * 0.38;

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(transformed, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.22) discard;

  gl_FragColor = tex;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export class HeroIrises extends THREE.Group {
  private materials: THREE.ShaderMaterial[] = []
  private geometries: THREE.BufferGeometry[] = []
  private textures: THREE.CanvasTexture[] = []
  private flowerGroups: THREE.Group[] = []

  constructor(options: HeroIrisesOptions = {}) {
    super()

    const windDir = windDirectionVec2(options.windDirection ?? 35)

    // Four exact irises matching the oil painting composition:
    // 0: Crimson-Red, 1: Golden-Yellow, 2: Blush-Pink, 3: Royal-Blue
    const flowerConfigs = [
      {
        x: -1.35,
        z: 6.0,
        height: 1.35,
        width: 1.02,
        rotY: 0.12,
      },
      {
        x: -0.48,
        z: 5.65,
        height: 1.62,
        width: 1.15,
        rotY: -0.05,
      },
      {
        x: 0.48,
        z: 5.75,
        height: 1.5,
        width: 1.1,
        rotY: 0.08,
      },
      {
        x: 1.35,
        z: 6.1,
        height: 1.38,
        width: 1.0,
        rotY: -0.15,
      },
    ]

    for (let index = 0; index < flowerConfigs.length; index += 1) {
      const cfg = flowerConfigs[index]
      const texture = createHeroIrisTexture(index)
      this.textures.push(texture)

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: texture },
          uTime: { value: 0 },
          uWindStrength: { value: options.windStrength ?? 0.45 },
          uWindSpeed: { value: options.windSpeed ?? 1.6 },
          uWindFrequency: { value: 0.65 },
          uWindTurbulence: { value: 0.35 },
          uWindLean: { value: 0.08 },
          uWindDirection: { value: windDir },
        },
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.22,
        depthWrite: true,
        toneMapped: true,
      })
      this.materials.push(material)

      // Dual-card crossed planes with front card and cross card for 3D fullness
      const cardA = new THREE.PlaneGeometry(cfg.width, cfg.height)
      cardA.translate(0, cfg.height * 0.5, 0)
      cardA.rotateY(-Math.PI * 0.12)
      this.geometries.push(cardA)

      const cardB = new THREE.PlaneGeometry(cfg.width * 0.75, cfg.height)
      cardB.translate(0, cfg.height * 0.5, 0)
      cardB.rotateY(Math.PI * 0.28)
      this.geometries.push(cardB)

      const meshA = new THREE.Mesh(cardA, material)
      const meshB = new THREE.Mesh(cardB, material)

      const flowerGroup = new THREE.Group()
      flowerGroup.add(meshA, meshB)
      flowerGroup.position.set(cfg.x, 0, cfg.z)
      flowerGroup.rotation.y = cfg.rotY
      this.flowerGroups.push(flowerGroup)

      this.add(flowerGroup)
    }
  }

  update(timeSeconds: number): void {
    for (const mat of this.materials) {
      mat.uniforms.uTime.value = timeSeconds
    }
  }

  setWind(wind: { strength?: number; speed?: number; direction?: number }): void {
    const dir = wind.direction !== undefined ? windDirectionVec2(wind.direction) : undefined
    for (const mat of this.materials) {
      if (wind.strength !== undefined) mat.uniforms.uWindStrength.value = wind.strength
      if (wind.speed !== undefined) mat.uniforms.uWindSpeed.value = wind.speed
      if (dir) mat.uniforms.uWindDirection.value.copy(dir)
    }
  }

  adjustToTerrain(ground: THREE.Mesh): void {
    const raycaster = new THREE.Raycaster()
    const down = new THREE.Vector3(0, -1, 0)
    for (const group of this.flowerGroups) {
      raycaster.set(new THREE.Vector3(group.position.x, 50, group.position.z), down)
      const hit = raycaster.intersectObject(ground, false)[0]
      if (hit) {
        group.position.y = hit.point.y
      }
    }
  }

  dispose(): void {
    for (const geom of this.geometries) geom.dispose()
    for (const mat of this.materials) mat.dispose()
    for (const tex of this.textures) tex.dispose()
    this.clear()
  }
}
