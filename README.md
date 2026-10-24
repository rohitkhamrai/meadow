# three-stylized

A Three.js meadow renderer with procedural terrain, instanced grass, wind
animation, stylized lighting, and deterministic wildflowers.

![cover.jpeg](./cover.jpeg)

[English](#english) | [中文](#中文)

## English

### Attribution

This project was inspired by and adapted from
[cortiz2894/stylized-components](https://github.com/cortiz2894/stylized-components).
The stylized meadow renderer itself relies only on Three.js, with no additional
framework or rendering dependency required.

### Features

- Procedural terrain with deterministic height variation
- Instanced grass blades sampled across generated or caller-provided geometry
- Runtime wind, color, brightness, and directional-light updates
- Optional deterministic wildflowers synchronized with the grass animation
- Partial configuration updates with immutable normalized option snapshots
- Explicit ownership and idempotent cleanup of generated GPU resources

### Requirements

- Node.js `^20.19.0 || >=22.12.0`
- pnpm 11 or a compatible package manager
- A WebGL-capable browser

### Run the demo

```sh
pnpm install
pnpm dev
```

Vite prints the local development URL. For a production build and local preview:

```sh
pnpm build
pnpm preview
```

### Basic usage

Given an existing Three.js renderer and camera:

```ts
import * as THREE from 'three'
import { Grass } from './src/grass'

const scene = new THREE.Scene()
const meadow = new Grass({
  terrain: { width: 24, depth: 18, terrainDegree: 0.35 },
  grass: {
    density: 36,
    wind: { strength: 0.2, direction: 45 },
  },
  wildflowers: { enabled: true, density: 0.75 },
})

scene.add(meadow)

renderer.setAnimationLoop((time) => {
  meadow.update(time * 0.001)
  renderer.render(scene, camera)
})

// When the meadow is no longer needed:
scene.remove(meadow)
meadow.dispose()
```

`Grass` extends `THREE.Group`, so it can be positioned, rotated, scaled, and
parented like any other Three.js object.

### Configuration

Every input field is optional. `setOptions(patch)` deep-merges nested option
groups, validates the resulting configuration, and either updates live resources
or rebuilds only the affected layers.

#### `GrassOptions`

| Field         | Type                     | Description                                                                             |
| ------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| `surface`     | `THREE.Mesh`             | Caller-owned sampling and display surface. When present, generated terrain is disabled. |
| `coverage`    | `GrassCoverageOptions`   | Optional shared coverage source for grass and wildflowers on an external surface.       |
| `terrain`     | `TerrainOptions`         | Generated terrain dimensions, resolution, shape, seed, and color.                       |
| `grass`       | `GrassLayerOptions`      | Blade layout, wind, colors, brightness, shadows, and lighting.                          |
| `wildflowers` | `WildflowerLayerOptions` | Optional flower generation and deterministic placement.                                 |

#### Terrain

| Field           | Type                        | Facade default | Constraints                                   |
| --------------- | --------------------------- | -------------- | --------------------------------------------- |
| `width`         | `number`                    | `20`           | Finite and greater than 0.                    |
| `depth`         | `number`                    | `20`           | Finite and greater than 0.                    |
| `segments`      | `number`                    | `72`           | Integer greater than or equal to 2.           |
| `seed`          | `number`                    | `17`           | Finite; also drives omitted vegetation seeds. |
| `terrainDegree` | `number`                    | `0.8`          | Finite value from 0 to 1.                     |
| `groundColor`   | `THREE.ColorRepresentation` | `#557d24`      | Any Three.js color representation.            |

#### Grass layout and appearance

| Field              | Type                   | Facade default              | Constraints                                                                    |
| ------------------ | ---------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| `density`          | `number`               | `40`                        | Finite and greater than 0.                                                     |
| `seed`             | `number`               | Derived from `terrain.seed` | Finite.                                                                        |
| `coverage`         | `GrassCoverageOptions` | Inherited                   | Overrides shared `coverage` for blades only.                                   |
| `brightness`       | `number`               | `0.35`                      | Finite and nonnegative.                                                        |
| `shadow`           | `boolean`              | `false`                     | Enables grass and wildflower shadow casting; blades also receive shadows.      |
| `blade.minWidth`   | `number`               | `0.035`                     | Finite, positive, and no greater than `maxWidth`.                              |
| `blade.maxWidth`   | `number`               | `0.16`                      | Finite, positive, and no less than `minWidth`.                                 |
| `blade.minHeight`  | `number`               | `0.705`                     | Finite, positive, and no greater than `maxHeight`.                             |
| `blade.maxHeight`  | `number`               | `1.5`                       | Finite, positive, and no less than `minHeight`.                                |
| `blade.segments`   | `number`               | `4`                         | Positive integer.                                                              |
| `blade.lean`       | `number`               | `0.1`                       | Finite.                                                                        |
| `colors.bottom`    | `GrassColor`           | `#4f7c13`                   | Blade base color.                                                              |
| `colors.top`       | `GrassColor`           | `#b8da57`                   | Blade tip color.                                                               |
| `colors.backlight` | `GrassColor`           | `#c1e54d`                   | Blade backlight tint.                                                          |
| `colors.ground`    | `GrassColor`           | `#4f7c13`                   | Normalized grass ground tone; use `terrain.groundColor` for generated terrain. |

#### Wind and lighting

| Field                        | Type            | Facade default                 | Constraints                        |
| ---------------------------- | --------------- | ------------------------------ | ---------------------------------- |
| `wind.strength`              | `number`        | `0.22`                         | Finite and nonnegative.            |
| `wind.speed`                 | `number`        | `1.1`                          | Finite and nonnegative.            |
| `wind.frequency`             | `number`        | `0.55`                         | Finite and nonnegative.            |
| `wind.turbulence`            | `number`        | `0.24`                         | Finite and nonnegative.            |
| `wind.lean`                  | `number`        | `0.035`                        | Finite.                            |
| `wind.direction`             | `number`        | `32`                           | Finite angle in degrees.           |
| `lighting.direction`         | `THREE.Vector3` | `(-0.4, 0.85, 0.3)` normalized | All components must be finite.     |
| `lighting.color`             | `GrassColor`    | `#fff5cf`                      | Any Three.js color representation. |
| `lighting.intensity`         | `number`        | `1.1`                          | Finite and nonnegative.            |
| `lighting.backlightStrength` | `number`        | `2.5`                          | Finite and nonnegative.            |
| `lighting.backlightPower`    | `number`        | `3`                            | Finite and greater than 0.         |
| `lighting.backlightTip`      | `number`        | `0.6`                          | Finite value from 0 to 1.          |

#### Wildflowers

| Field      | Type                   | Facade default              | Constraints                                       |
| ---------- | ---------------------- | --------------------------- | ------------------------------------------------- |
| `enabled`  | `boolean`              | `true`                      | Creates or removes the flower layer.              |
| `density`  | `number`               | `0.84`                      | Finite and nonnegative.                           |
| `maxCount` | `number`               | `240`                       | Nonnegative integer.                              |
| `seed`     | `number`               | Derived from `terrain.seed` | Finite.                                           |
| `coverage` | `GrassCoverageOptions` | Inherited                   | Overrides shared `coverage` for wildflowers only. |

An external `surface` must be a `THREE.Mesh` with a position attribute.
`update(timeSeconds)` also requires a finite time value. Invalid configuration
throws `RangeError` before the current scene state is changed.

### External surfaces

```ts
const surface = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: '#557d24' }),
)

const meadow = new Grass({ surface })

// Grass uses the mesh for placement but never disposes its geometry or material.
```

### Coverage masks

Use `coverage` to restrict vegetation on a supplied surface. A coverage value
of `0` means no vegetation and `1` applies the configured density. Choose one
source: a UV `map`, a scalar or vector geometry `attribute`, or a procedural
`sample` callback. A coverage source is only meaningful with an external
`surface`; maps require a `uv` geometry attribute.

| Field       | Type                                    | Default | Description                                                                                                |
| ----------- | --------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `map`       | `THREE.Texture \| string`               | -       | Samples a texture at the surface UV.                                                                       |
| `attribute` | `string`                                | -       | Samples the named scalar or vector geometry attribute.                                                     |
| `sample`    | `(point: GrassCoveragePoint) => number` | -       | Calculates coverage procedurally from world position, normal, UV, and a deterministic seed.                |
| `channel`   | `'r' \| 'g' \| 'b' \| 'a'`              | `'r'`   | Component to read from a map or vector attribute.                                                          |
| `threshold` | `number`                                | `0`     | Values at or below this value produce no vegetation.                                                       |
| `power`     | `number`                                | `1`     | Nonnegative exponent applied after thresholding; larger values concentrate vegetation in brighter regions. |

For a source value `v`, the implementation clamps it to `0..1`. When
`v <= threshold`, coverage is `0`; otherwise, it applies
`((v - threshold) / (1 - threshold)) ^ power`. Thus `threshold` is more than a
binary cutoff: it also remaps every value above the cutoff back across the
full `0..1` coverage range. A `threshold` of `0.05` removes black pixels and
very dark anti-aliased or noisy pixels, while white remains full coverage.

For the default `'r'` channel, use an opaque grayscale or red-channel mask:
black (`r = 0`) excludes vegetation and white (`r = 1`) permits it at the
configured density. Alpha does not affect coverage unless `channel: 'a'` is
selected. The included [`src/assets/coverage.png`](src/assets/coverage.png) fixture is a
512 by 512 black mask with a white circular grass island, suitable for the
`?coverage-demo=1` external-surface preview.

```ts
const meadow = new Grass({
  surface,
  coverage: { map: '/textures/meadow-coverage.png', channel: 'r', threshold: 0.05 },
  wildflowers: { density: 0.75 },
})

await meadow.ready
```

`map` accepts either a URL string or any readable `THREE.Texture`. URL maps
are loaded by `Grass`; while loading, their coverage is zero, then blades and
wildflowers are rebuilt before `ready` resolves. For a texture loaded by the
application, pass it after `TextureLoader.loadAsync()` completes:

```ts
const coverageMap = await new THREE.TextureLoader().loadAsync('/textures/meadow-coverage.png')
const meadow = new Grass({ surface, coverage: { map: coverageMap } })
```

Wildflowers inherit the shared `coverage`. Set `wildflowers.coverage` to give
them a different map, attribute, or callback; `grass.coverage` similarly
overrides the shared default for blades only. Texture images must permit canvas
pixel reads, so cross-origin maps need suitable CORS headers. Caller-provided
textures and callbacks remain caller-owned. Run `pnpm dev` and open
`/?coverage-demo=1` to inspect the UV-mask fixture used for visual verification.

The caller retains ownership of the mesh, geometry, and material. `Grass`
samples the supplied mesh, exposes that exact mesh through `surface`, and
renders a non-owning visual clone without reparenting the original. Calling
`dispose()` never disposes caller-owned resources.

### Runtime updates

```ts
meadow.syncDirectionalLight(sun)
meadow.setOptions({
  grass: { wind: { strength: 0.35 } },
  terrain: { groundColor: '#245f93' },
})
```

Wind, blade colors, brightness, lighting, and generated ground color update
without replacing the facade. Structural changes such as terrain dimensions,
surface, blade layout, density, seeds, or wildflower generation rebuild the
affected resources and refresh the public counts.

### Public API

#### `Grass` properties

| Property          | Type                                        | Description                                                           |
| ----------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| `blades`          | Internal grass layer handle                 | Current instanced blade renderer. Prefer `bladeCount` for statistics. |
| `wildflowers`     | Internal flower layer handle or `undefined` | Present only while wildflowers are enabled.                           |
| `ground`          | `THREE.Mesh \| undefined`                   | Generated visible ground; absent when using an external surface.      |
| `surface`         | `THREE.Mesh`                                | Active sampling surface.                                              |
| `bladeCount`      | `number`                                    | Current number of instanced blades.                                   |
| `wildflowerCount` | `number`                                    | Current number of flowers, or 0 when disabled.                        |
| `ready`           | `Promise<void>`                             | Resolves when URL coverage maps for the current options are readable. |
| `options`         | `ReadonlyGrassFacadeOptions`                | Deeply frozen snapshot with cloned colors and vectors.                |

#### `Grass` methods

| Method                        | Description                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `new Grass(options?)`         | Creates generated terrain and vegetation, or attaches vegetation to a caller-owned surface.                                |
| `setOptions(patch)`           | Deep-merges and validates a partial patch, then updates or rebuilds affected layers. Calls after disposal are safe no-ops. |
| `update(timeSeconds)`         | Advances grass and flower animation and synchronizes an external surface visual.                                           |
| `syncDirectionalLight(light)` | Copies a `THREE.DirectionalLight` direction, color, and intensity into the blade shader.                                   |
| `dispose()`                   | Releases owned terrain and vegetation resources. It is idempotent and preserves external resources.                        |

The public entry exports these input and readonly snapshot types:
`GrassOptions`, `TerrainOptions`, `GrassLayerOptions`,
`WildflowerLayerOptions`, `GrassBladeOptions`, `GrassWindOptions`,
`GrassColorOptions`, `GrassLightingOptions`, `GrassCoverageOptions`,
`GrassCoveragePoint`, `GrassCoverageChannel`, `GrassCoverageMap`, `GrassColor`,
`ReadonlyGrassFacadeOptions`, `ReadonlyNormalizedGrassBladeOptions`,
`ReadonlyNormalizedGrassColorOptions`, `ReadonlyNormalizedGrassLayerOptions`,
`ReadonlyNormalizedGrassLightingOptions`,
`ReadonlyNormalizedGrassWindOptions`, `ReadonlyNormalizedTerrainOptions`, and
`ReadonlyNormalizedWildflowerLayerOptions`.

Internal implementation classes such as `Terrain`, `GrassLayer`, and
`Wildflowers` are not exported from `./src/grass`.

### Defaults and helpers

The entry exports immutable `DEFAULT_TERRAIN_OPTIONS`,
`DEFAULT_GRASS_OPTIONS`, and `DEFAULT_WILDFLOWER_OPTIONS` constants. Their
literal layer defaults are:

| Constant                     | Values                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `DEFAULT_TERRAIN_OPTIONS`    | `width: 20`, `depth: 20`, `segments: 72`, `seed: 17`, `terrainDegree: 0.8`, `groundColor: '#557d24'` |
| `DEFAULT_GRASS_OPTIONS`      | `density: 40`, `seed: 1`, blade, wind, color, brightness, and lighting defaults listed above         |
| `DEFAULT_WILDFLOWER_OPTIONS` | `enabled: true`, `density: 0.84`, `maxCount: 240`, `seed: 29`                                        |

When `grass.seed` or `wildflowers.seed` is omitted, the `Grass` facade
derives it deterministically from `terrain.seed`. Therefore, the exported
layer seed constants are not the normalized seed values of a default
`new Grass()` instance.

`GrassLayerKind` contains `Terrain = 'terrain'`, `Blades = 'blades'`, and
`Wildflowers = 'wildflowers'`.

The demo-oriented control helpers are also public:

| Export                          | Value or behavior                                                 |
| ------------------------------- | ----------------------------------------------------------------- |
| `BLADE_WIDTH_CONTROL`           | `{ min: 0.01, max: 0.16, default: 0.1 }`                          |
| `bladeWidthsFromControl(value)` | Returns proportional `minWidth` and `maxWidth` values.            |
| `DENSITY_CONTROL`               | `{ min: 8, max: 1000, default: 800 }`                             |
| `densityFromControl(value)`     | Divides the control value by 20 to produce blades per world unit. |

Both mapping functions throw `RangeError` for non-finite or non-positive
values.

### Development

| Command              | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `pnpm dev`           | Start the Vite demo server.                                 |
| `pnpm build`         | Type-check and build the demo.                              |
| `pnpm test -- --run` | Run the Vitest suite once.                                  |
| `pnpm lint`          | Check source with Oxlint.                                   |
| `pnpm lint:fix`      | Apply safe Oxlint fixes.                                    |
| `pnpm fmt`           | Format maintained files with Oxfmt.                         |
| `pnpm fmt:check`     | Check formatting without writing.                           |
| `pnpm check`         | Run lint, format checking, tests, and the production build. |

---

## 中文

### 致谢

本项目参考并改造自
[cortiz2894/stylized-components](https://github.com/cortiz2894/stylized-components)。
风格化草地渲染核心仅依赖 Three.js，不依赖其他框架或渲染相关依赖。

### 特性

- 可根据 seed 确定性生成起伏地形
- 通过实例化草叶覆盖生成地形或调用方提供的几何曲面
- 支持运行时更新风、颜色、亮度和方向光
- 支持与草叶动画同步的确定性野花层
- 支持局部配置更新，并提供不可变的规范化配置快照
- 明确管理生成的 GPU 资源所有权，并提供幂等清理

### 环境要求

- Node.js `^20.19.0 || >=22.12.0`
- pnpm 11 或兼容的包管理器
- 支持 WebGL 的浏览器

### 运行示例

```sh
pnpm install
pnpm dev
```

Vite 会输出本地开发地址。构建生产版本并在本地预览：

```sh
pnpm build
pnpm preview
```

### 基本用法

假设项目中已经存在 Three.js renderer 和 camera：

```ts
import * as THREE from 'three'
import { Grass } from './src/grass'

const scene = new THREE.Scene()
const meadow = new Grass({
  terrain: { width: 24, depth: 18, terrainDegree: 0.35 },
  grass: {
    density: 36,
    wind: { strength: 0.2, direction: 45 },
  },
  wildflowers: { enabled: true, density: 0.75 },
})

scene.add(meadow)

renderer.setAnimationLoop((time) => {
  meadow.update(time * 0.001)
  renderer.render(scene, camera)
})

// When the meadow is no longer needed:
scene.remove(meadow)
meadow.dispose()
```

`Grass` 继承自 `THREE.Group`，可以像其他 Three.js 对象一样设置位置、
旋转和缩放，也可以加入任意对象层级。

### 配置

所有输入字段均为可选字段。`setOptions(patch)` 会深度合并嵌套配置、验证合并后的
结果，然后实时更新资源，或只重建受影响的层。

#### `GrassOptions`

| 字段          | 类型                     | 说明                                                   |
| ------------- | ------------------------ | ------------------------------------------------------ |
| `surface`     | `THREE.Mesh`             | 由调用方持有的采样与显示曲面。提供后不会生成内部地形。 |
| `coverage`    | `GrassCoverageOptions`   | 外部曲面上草叶与野花共用的可选覆盖来源。               |
| `terrain`     | `TerrainOptions`         | 生成地形的尺寸、精度、形态、seed 和颜色。              |
| `grass`       | `GrassLayerOptions`      | 草叶布局、风、颜色、亮度、阴影和光照。                 |
| `wildflowers` | `WildflowerLayerOptions` | 野花开关、数量与确定性分布。                           |

#### 地形

| 字段            | 类型                        | facade 默认值 | 约束                                          |
| --------------- | --------------------------- | ------------- | --------------------------------------------- |
| `width`         | `number`                    | `20`          | 有限且大于 0。                                |
| `depth`         | `number`                    | `20`          | 有限且大于 0。                                |
| `segments`      | `number`                    | `72`          | 大于等于 2 的整数。                           |
| `seed`          | `number`                    | `17`          | 有限；未提供植被 seed 时也用于派生植被 seed。 |
| `terrainDegree` | `number`                    | `0.8`         | 0 到 1 之间的有限值。                         |
| `groundColor`   | `THREE.ColorRepresentation` | `#557d24`     | 任意 Three.js 颜色表示。                      |

#### 草叶布局与外观

| 字段               | 类型                   | facade 默认值          | 约束                                                             |
| ------------------ | ---------------------- | ---------------------- | ---------------------------------------------------------------- |
| `density`          | `number`               | `40`                   | 有限且大于 0。                                                   |
| `seed`             | `number`               | 从 `terrain.seed` 派生 | 有限。                                                           |
| `coverage`         | `GrassCoverageOptions` | 继承共享值             | 仅覆盖草叶的共享 `coverage`。                                    |
| `brightness`       | `number`               | `0.35`                 | 有限且非负。                                                     |
| `shadow`           | `boolean`              | `false`                | 实时切换草叶与野花投影；草叶也会接收阴影，无需重建草地。         |
| `blade.minWidth`   | `number`               | `0.035`                | 有限、为正且不大于 `maxWidth`。                                  |
| `blade.maxWidth`   | `number`               | `0.16`                 | 有限、为正且不小于 `minWidth`。                                  |
| `blade.minHeight`  | `number`               | `0.705`                | 有限、为正且不大于 `maxHeight`。                                 |
| `blade.maxHeight`  | `number`               | `1.5`                  | 有限、为正且不小于 `minHeight`。                                 |
| `blade.segments`   | `number`               | `4`                    | 正整数。                                                         |
| `blade.lean`       | `number`               | `0.1`                  | 有限。                                                           |
| `colors.bottom`    | `GrassColor`           | `#4f7c13`              | 草叶根部颜色。                                                   |
| `colors.top`       | `GrassColor`           | `#b8da57`              | 草叶尖端颜色。                                                   |
| `colors.backlight` | `GrassColor`           | `#c1e54d`              | 草叶背光颜色。                                                   |
| `colors.ground`    | `GrassColor`           | `#4f7c13`              | 规范化的草地色调；生成地形的可见颜色使用 `terrain.groundColor`。 |

#### 风与光照

| 字段                         | 类型            | facade 默认值                | 约束                     |
| ---------------------------- | --------------- | ---------------------------- | ------------------------ |
| `wind.strength`              | `number`        | `0.22`                       | 有限且非负。             |
| `wind.speed`                 | `number`        | `1.1`                        | 有限且非负。             |
| `wind.frequency`             | `number`        | `0.55`                       | 有限且非负。             |
| `wind.turbulence`            | `number`        | `0.24`                       | 有限且非负。             |
| `wind.lean`                  | `number`        | `0.035`                      | 有限。                   |
| `wind.direction`             | `number`        | `32`                         | 使用角度制的有限值。     |
| `lighting.direction`         | `THREE.Vector3` | 规范化的 `(-0.4, 0.85, 0.3)` | 所有分量必须有限。       |
| `lighting.color`             | `GrassColor`    | `#fff5cf`                    | 任意 Three.js 颜色表示。 |
| `lighting.intensity`         | `number`        | `1.1`                        | 有限且非负。             |
| `lighting.backlightStrength` | `number`        | `2.5`                        | 有限且非负。             |
| `lighting.backlightPower`    | `number`        | `3`                          | 有限且大于 0。           |
| `lighting.backlightTip`      | `number`        | `0.6`                        | 0 到 1 之间的有限值。    |

#### 野花

| 字段       | 类型                   | facade 默认值          | 约束                          |
| ---------- | ---------------------- | ---------------------- | ----------------------------- |
| `enabled`  | `boolean`              | `true`                 | 创建或移除野花层。            |
| `density`  | `number`               | `0.84`                 | 有限且非负。                  |
| `maxCount` | `number`               | `240`                  | 非负整数。                    |
| `seed`     | `number`               | 从 `terrain.seed` 派生 | 有限。                        |
| `coverage` | `GrassCoverageOptions` | 继承共享值             | 仅覆盖野花的共享 `coverage`。 |

外部 `surface` 必须是位置属性有效的 `THREE.Mesh`。`update(timeSeconds)`
也要求时间参数为有限值。无效配置会在当前场景状态被修改前抛出 `RangeError`。

### 外部曲面

```ts
const surface = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: '#557d24' }),
)

const meadow = new Grass({ surface })

// Grass uses the mesh for placement but never disposes its geometry or material.
```

调用方始终持有 mesh、geometry 和 material。`Grass` 会在传入的 mesh 上采样，
通过 `surface` 返回同一个 mesh，并使用不拥有资源的可视副本渲染，而不会改变
原对象的父级。调用 `dispose()` 不会释放任何调用方资源。

### 覆盖遮罩

`coverage` 用于限制外部 `surface` 上允许生成植被的区域。`map`、`attribute`
和 `sample` 三种来源只能选择一种；贴图来源要求 geometry 带有 `uv` 属性。

| 字段        | 类型                                    | 默认值 | 说明                                                 |
| ----------- | --------------------------------------- | ------ | ---------------------------------------------------- |
| `map`       | `THREE.Texture \| string`               | -      | 根据曲面 UV 采样贴图。                               |
| `attribute` | `string`                                | -      | 采样指定的标量或向量 geometry attribute。            |
| `sample`    | `(point: GrassCoveragePoint) => number` | -      | 由世界坐标、法线、UV 和确定性 seed 计算覆盖值。      |
| `channel`   | `'r' \| 'g' \| 'b' \| 'a'`              | `'r'`  | 从贴图或向量 attribute 中读取的分量。                |
| `threshold` | `number`                                | `0`    | 小于或等于此值的区域不生成植被。                     |
| `power`     | `number`                                | `1`    | 阈值处理后的非负指数；值越大，植被越集中在高亮区域。 |

源值会先限制在 `0..1`。当 `v <= threshold` 时，最终覆盖值为 `0`；否则为
`((v - threshold) / (1 - threshold)) ^ power`。因此 `threshold` 不仅是二元
开关，也会将阈值以上的范围重新映射到完整的 `0..1` 覆盖度。常用的
`threshold: 0.05` 会排除黑色、极深灰和边缘抗锯齿像素，白色仍保持完整覆盖。

默认读取红色通道：黑色（`r = 0`）不长草，白色（`r = 1`）按配置密度生成。
除非设置 `channel: 'a'`，透明度不会参与判断。仓库内的
[`src/assets/coverage.png`](src/assets/coverage.png) 是 512×512 的黑底白色圆形遮罩，可用于
`?coverage-demo=1` 的外部曲面验证。

```ts
const meadow = new Grass({
  surface,
  coverage: { map: '/textures/meadow-coverage.png', channel: 'r', threshold: 0.05 },
  wildflowers: { density: 0.75 },
})

await meadow.ready
```

`map` 可以是 URL 或可读的 `THREE.Texture`。URL 由 `Grass` 加载；加载完成前覆盖值
为零，完成后会重建草叶和野花，`ready` 才会 resolve。跨域贴图必须允许 Canvas
读取像素。野花默认继承共享 `coverage`；可用 `wildflowers.coverage` 覆盖，
`grass.coverage` 则只覆盖草叶。调用方提供的贴图与回调仍归调用方所有。

### 运行时更新

```ts
meadow.syncDirectionalLight(sun)
meadow.setOptions({
  grass: { wind: { strength: 0.35 } },
  terrain: { groundColor: '#245f93' },
})
```

风、草叶颜色、亮度、光照和生成地面的颜色可以实时更新，不会替换 facade。
地形尺寸、采样曲面、草叶布局、密度、seed 或野花生成等结构性变化会重建受影响的
资源，并刷新公开数量。

### 公开 API

#### `Grass` 属性

| 属性              | 类型                         | 说明                                                       |
| ----------------- | ---------------------------- | ---------------------------------------------------------- |
| `blades`          | 内部草叶层句柄               | 当前实例化草叶 renderer。统计数量时优先使用 `bladeCount`。 |
| `wildflowers`     | 内部野花层句柄或 `undefined` | 只在启用野花时存在。                                       |
| `ground`          | `THREE.Mesh \| undefined`    | 生成的可见地面；使用外部曲面时不存在。                     |
| `surface`         | `THREE.Mesh`                 | 当前采样曲面。                                             |
| `bladeCount`      | `number`                     | 当前实例化草叶数量。                                       |
| `wildflowerCount` | `number`                     | 当前野花数量；禁用时为 0。                                 |
| `ready`           | `Promise<void>`              | 当前 URL coverage map 可读取时 resolve。                   |
| `options`         | `ReadonlyGrassFacadeOptions` | 深度冻结的快照，其中颜色和向量均为克隆值。                 |

#### `Grass` 方法

| 方法                          | 说明                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `new Grass(options?)`         | 创建地形与植被，或在调用方持有的曲面上附加植被。                             |
| `setOptions(patch)`           | 深度合并并验证局部配置，然后更新或重建受影响的层。释放后调用是安全的空操作。 |
| `update(timeSeconds)`         | 推进草叶和野花动画，并同步外部曲面的可视副本。                               |
| `syncDirectionalLight(light)` | 将 `THREE.DirectionalLight` 的方向、颜色和强度同步到草叶 shader。            |
| `dispose()`                   | 释放内部拥有的地形和植被资源。该方法幂等，并保留外部资源。                   |

公开入口导出以下输入类型和只读快照类型：`GrassOptions`、
`TerrainOptions`、`GrassLayerOptions`、`WildflowerLayerOptions`、
`GrassBladeOptions`、`GrassWindOptions`、`GrassColorOptions`、
`GrassLightingOptions`、`GrassCoverageOptions`、`GrassCoveragePoint`、
`GrassCoverageChannel`、`GrassCoverageMap`、`GrassColor`、
`ReadonlyGrassFacadeOptions`、
`ReadonlyNormalizedGrassBladeOptions`、
`ReadonlyNormalizedGrassColorOptions`、
`ReadonlyNormalizedGrassLayerOptions`、
`ReadonlyNormalizedGrassLightingOptions`、
`ReadonlyNormalizedGrassWindOptions`、
`ReadonlyNormalizedTerrainOptions` 和
`ReadonlyNormalizedWildflowerLayerOptions`。

`Terrain`、`GrassLayer` 和 `Wildflowers` 等内部实现类不会从
`./src/grass` 导出。

### 默认值与辅助函数

入口导出不可变的 `DEFAULT_TERRAIN_OPTIONS`、
`DEFAULT_GRASS_OPTIONS` 和 `DEFAULT_WILDFLOWER_OPTIONS` 常量。
它们的字面 layer 默认值为：

| 常量                         | 值                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `DEFAULT_TERRAIN_OPTIONS`    | `width: 20`、`depth: 20`、`segments: 72`、`seed: 17`、`terrainDegree: 0.8`、`groundColor: '#557d24'` |
| `DEFAULT_GRASS_OPTIONS`      | `density: 40`、`seed: 1`，以及上表列出的草叶、风、颜色、亮度和光照默认值                             |
| `DEFAULT_WILDFLOWER_OPTIONS` | `enabled: true`、`density: 0.84`、`maxCount: 240`、`seed: 29`                                        |

未提供 `grass.seed` 或 `wildflowers.seed` 时，`Grass` facade 会根据
`terrain.seed` 确定性派生。因此，导出的 layer seed 常量并不是默认
`new Grass()` 实例中的规范化 seed。

`GrassLayerKind` 包含 `Terrain = 'terrain'`、`Blades = 'blades'`
和 `Wildflowers = 'wildflowers'`。

面向示例控制面板的辅助函数也属于公开导出：

| 导出                            | 值或行为                                      |
| ------------------------------- | --------------------------------------------- |
| `BLADE_WIDTH_CONTROL`           | `{ min: 0.01, max: 0.16, default: 0.1 }`      |
| `bladeWidthsFromControl(value)` | 按比例返回 `minWidth` 和 `maxWidth`。         |
| `DENSITY_CONTROL`               | `{ min: 8, max: 1000, default: 800 }`         |
| `densityFromControl(value)`     | 将控制值除以 20，得到每个世界单位的草叶数量。 |

两个映射函数都会对非有限值或非正值抛出 `RangeError`。

### 开发命令

| 命令                 | 用途                                      |
| -------------------- | ----------------------------------------- |
| `pnpm dev`           | 启动 Vite 示例服务器。                    |
| `pnpm build`         | 执行类型检查并构建示例。                  |
| `pnpm test -- --run` | 单次运行 Vitest 测试套件。                |
| `pnpm lint`          | 使用 Oxlint 检查源码。                    |
| `pnpm lint:fix`      | 应用 Oxlint 的安全修复。                  |
| `pnpm fmt`           | 使用 Oxfmt 格式化维护文件。               |
| `pnpm fmt:check`     | 只检查格式，不写入文件。                  |
| `pnpm check`         | 依次运行 lint、格式检查、测试和生产构建。 |
