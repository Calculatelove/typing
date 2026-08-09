# 地图、车辆与闭环追逐核心实施计划

> **供智能开发者执行：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项实施本计划。步骤使用复选框（`- [ ]`）跟踪。

**目标：** 建立可独立测试的闭环道路、车辆运动、抓捕与同步掉头核心，并提供仅供开发观察的 Canvas 自动追逐页面。

**架构：** 以道路弧长位置作为唯一权威空间状态；道路模块把闭合 Catmull–Rom 曲线预采样为累计弧长查找表，车辆模块只负责沿弧长推进和投影。追逐模块用有向环距和阈值穿越时刻处理抓捕、套圈掉头及防抖，React/Canvas 只消费核心状态，不参与规则判定。

**技术栈：** Vite 8、React 19、TypeScript 6、HTML Canvas、Vitest 4、CSS、Oxlint。

## 全局约束

- 产品名称只能使用 Typing Gaming；不得在 UI、注释、README、标识符或资源中引用任何玩法参考产品名称。
- 只实现地图、车辆、闭环追逐数学和临时调试预览；不实现完整打字、正式 AI、文章库或正式游戏 UI。
- React 负责调试页结构，Canvas 负责地图、装饰和车辆；核心规则不得依赖 React、DOM 或 Canvas。
- 车辆规则只使用道路弧长和有向环距；不得用二维欧氏距离判定抓捕或套圈。
- 所有视觉必须由本项目的 Canvas/CSS 原创绘制，不增加第三方美术、字体、音乐或图标资源。
- 模拟基于 `delta time`，单次外部时间增量限制为 `0.1s`。
- `0 < catchDistance < reverseThreshold < L / 2` 且 `reverseThreshold >= 5 × catchDistance`。
- 生产 base 保持 `/typing/`；不得引入服务器端依赖。
- 项目文档使用简体中文。
- 每个核心行为遵循红—绿—重构，并在本轮结束运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`。
- 保留且不提交用户已有的 `.gitignore` 修改。

---

## 文件结构

- 新建 `src/game/math.ts`：安全取模、向量归一化和线性插值等无业务纯函数。
- 修改 `src/game/types.ts`：集中定义向量、道路采样、车辆和追逐世界状态。
- 修改 `src/game/track.ts`：原创控制点、闭合 Catmull–Rom 预采样、累计弧长和 `sampleTrackAt`。
- 新建 `src/game/track.test.ts`：闭合、弧长规范化、方向和非简单椭圆行为测试。
- 修改 `src/game/vehicle.ts`：创建车辆、限制 `dt`、弧长推进和世界投影。
- 新建 `src/game/vehicle.test.ts`：正反运动、跨零点、异常 `dt` 和派生朝向测试。
- 新建 `src/game/pursuit.ts`：有向距离、参数校验、抓捕与掉头阈值穿越。
- 新建 `src/game/pursuit.test.ts`：抓捕、套圈、掉头、连续性与防抖测试。
- 修改 `src/game/engine.ts`：固定测试速度调试世界的初始化和单步入口，不包含正式 AI。
- 新建 `src/game/renderDebugScene.ts`：纯 Canvas 调试绘制，装饰与规则状态完全分离。
- 新建 `src/app/DebugChasePreview.tsx`：`requestAnimationFrame` 驱动的临时预览。
- 修改 `src/app/App.tsx`、`src/app/App.test.tsx`、`src/styles/global.css`：挂载可访问的调试页面并更新静态结构测试。

## 统一接口

```ts
export interface Vector2 { readonly x: number; readonly y: number }
export type Direction = 1 | -1
export type VehicleRole = 'police' | 'thief'

export interface TrackSample {
  readonly distance: number
  readonly position: Vector2
  readonly tangent: Vector2
  readonly normal: Vector2
  readonly heading: number
}

export interface Track {
  readonly controlPoints: readonly Vector2[]
  readonly samples: readonly TrackSample[]
  readonly length: number
  readonly roadWidth: number
  readonly bounds: Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>
}

export interface VehicleState {
  readonly role: VehicleRole
  readonly trackPosition: number
  readonly speed: number
  readonly direction: Direction
  readonly worldPosition: Vector2
  readonly heading: number
}

export interface PursuitConfig {
  readonly catchDistance: number
  readonly reverseThreshold: number
  readonly reverseHysteresis: number
  readonly reverseCooldownSeconds: number
  readonly maxDeltaSeconds: number
}

export interface PursuitState {
  readonly police: VehicleState
  readonly thief: VehicleState
  readonly captured: boolean
  readonly reverseArmed: boolean
  readonly reverseCooldownRemaining: number
  readonly reverseCount: number
}
```

### 任务 1：曲折闭环道路与弧长查找表

**文件：**

- 新建：`src/game/math.ts`
- 修改：`src/game/types.ts`
- 修改：`src/game/track.ts`
- 新建测试：`src/game/track.test.ts`

**接口：**

- 产出：`mod(value: number, modulus: number): number`。
- 产出：`createDefaultTrack(): Track`。
- 产出：`createClosedTrack(controlPoints: readonly Vector2[], options?: { samplesPerSegment?: number; roadWidth?: number }): Track`。
- 产出：`sampleTrackAt(track: Track, distance: number): TrackSample`。

- [ ] **步骤 1：写安全取模与闭合道路的失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { mod } from './math'
import { createClosedTrack, createDefaultTrack, sampleTrackAt } from './track'

describe('mod', () => {
  it('把负弧长安全规范到正区间', () => {
    expect(mod(-3, 10)).toBe(7)
    expect(mod(23, 10)).toBe(3)
  })
})

describe('闭合道路', () => {
  it('在 0、L 和负弧长处返回连续位置', () => {
    const track = createDefaultTrack()
    const start = sampleTrackAt(track, 0)
    const end = sampleTrackAt(track, track.length)
    const beforeStart = sampleTrackAt(track, -track.length)

    expect(end.position.x).toBeCloseTo(start.position.x, 8)
    expect(end.position.y).toBeCloseTo(start.position.y, 8)
    expect(beforeStart.position.x).toBeCloseTo(start.position.x, 8)
    expect(beforeStart.position.y).toBeCloseTo(start.position.y, 8)
  })

  it('按累计弧长采样而不是按控制点索引采样', () => {
    const track = createClosedTrack([
      { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 340, y: 80 },
      { x: 80, y: 220 }, { x: -80, y: 80 },
    ])
    const quarter = sampleTrackAt(track, track.length / 4)
    const next = sampleTrackAt(track, track.length / 4 + 1)
    const step = Math.hypot(next.position.x - quarter.position.x, next.position.y - quarter.position.y)

    expect(step).toBeGreaterThan(0.8)
    expect(step).toBeLessThan(1.2)
  })

  it('默认路线具有明显不规则曲率而非简单圆形或椭圆', () => {
    const track = createDefaultTrack()
    const centerX = (track.bounds.minX + track.bounds.maxX) / 2
    const centerY = (track.bounds.minY + track.bounds.maxY) / 2
    const radii = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((ratio) => {
      const point = sampleTrackAt(track, track.length * ratio).position
      return Math.hypot(point.x - centerX, point.y - centerY)
    })

    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(180)
    expect(track.controlPoints.length).toBeGreaterThanOrEqual(10)
  })
})
```

- [ ] **步骤 2：运行测试并确认因真实行为缺失而失败**

运行：`npm test -- src/game/track.test.ts`

预期：在补齐导出签名后，至少一个行为断言失败；不得把“模块不存在”的导入错误当作有效红灯。

- [ ] **步骤 3：实现最小道路数据模型和预采样**

实现细节：

```ts
export const DEFAULT_TRACK_CONTROL_POINTS: readonly Vector2[] = [
  { x: -520, y: -80 }, { x: -420, y: -330 }, { x: -120, y: -430 },
  { x: 100, y: -300 }, { x: 390, y: -380 }, { x: 560, y: -120 },
  { x: 430, y: 130 }, { x: 510, y: 360 }, { x: 180, y: 430 },
  { x: -40, y: 300 }, { x: -330, y: 420 }, { x: -560, y: 180 },
]
```

每个控制点区段使用闭合 Catmull–Rom 公式，以默认每段 `64` 个点密集采样；保存首点副本作为 `distance=L` 的末尾样本。累计相邻样本距离得到 `L`，切线取曲线导数并单位化，法线为 `{x:-tangent.y,y:tangent.x}`，朝向为 `atan2(tangent.y,tangent.x)`。`sampleTrackAt` 先用 `mod(distance,L)`，再二分累计距离并在线段内插值位置与单位切线。

- [ ] **步骤 4：运行道路测试并重构**

运行：`npm test -- src/game/track.test.ts`

预期：全部通过。随后保持 API 不变，移除重复向量运算并确认测试仍通过。

- [ ] **步骤 5：提交道路批次**

```bash
git add src/game/math.ts src/game/types.ts src/game/track.ts src/game/track.test.ts
git commit -m "feat: add closed track arc-length sampling"
```

### 任务 2：车辆推进、方向与世界投影

**文件：**

- 修改：`src/game/vehicle.ts`
- 新建测试：`src/game/vehicle.test.ts`

**接口：**

- 消费：`Track`、`VehicleState`、`Direction`、`sampleTrackAt` 和 `mod`。
- 产出：`MAX_DELTA_SECONDS = 0.1`。
- 产出：`createVehicle(track: Track, role: VehicleRole, trackPosition: number, speed: number, direction: Direction): VehicleState`。
- 产出：`advanceVehicle(track: Track, vehicle: VehicleState, deltaSeconds: number, maxDeltaSeconds?: number): VehicleState`。
- 产出：`reverseVehicle(track: Track, vehicle: VehicleState): VehicleState`。

- [ ] **步骤 1：写正反方向、跨零点和大 `dt` 的失败测试**

测试使用一条手写四边控制点道路和真实 `sampleTrackAt`，验证：

```ts
it.each([
  { direction: 1 as const, start: 10, speed: 20, dt: 0.05, expected: 11 },
  { direction: -1 as const, start: 10, speed: 20, dt: 0.05, expected: 9 },
])('按 $direction 方向使用 delta time 推进', ({ direction, start, speed, dt, expected }) => {
  const vehicle = createVehicle(track, 'police', start, speed, direction)
  expect(advanceVehicle(track, vehicle, dt).trackPosition).toBeCloseTo(expected, 8)
})

it('正反方向都能跨越 trackPosition=0', () => {
  const forward = advanceVehicle(track, createVehicle(track, 'thief', track.length - 0.5, 20, 1), 0.05)
  const backward = advanceVehicle(track, createVehicle(track, 'thief', 0.5, 20, -1), 0.05)
  expect(forward.trackPosition).toBeCloseTo(0.5, 8)
  expect(backward.trackPosition).toBeCloseTo(track.length - 0.5, 8)
})

it('把异常大的 dt 限制为 0.1 秒', () => {
  const vehicle = createVehicle(track, 'police', 20, 50, 1)
  expect(advanceVehicle(track, vehicle, 30).trackPosition).toBeCloseTo(25, 8)
})

it('反向行驶只改变朝向而不改变道路投影位置', () => {
  const forward = createVehicle(track, 'thief', 30, 10, 1)
  const backward = createVehicle(track, 'thief', 30, 10, -1)
  expect(backward.worldPosition).toEqual(forward.worldPosition)
  expect(Math.abs(Math.abs(backward.heading - forward.heading) - Math.PI)).toBeLessThan(1e-8)
})
```

- [ ] **步骤 2：运行并确认车辆测试按预期失败**

运行：`npm test -- src/game/vehicle.test.ts`

预期：导出签名补齐后，位置或朝向断言失败。

- [ ] **步骤 3：实现车辆纯函数**

`createVehicle` 将位置安全取模、速度限制为非负数，并从 `sampleTrackAt` 派生 `worldPosition`；反向车辆在道路切线朝向上加 `Math.PI`。`advanceVehicle` 将非有限或负 `dt` 视为零，其余限制到 `[0,maxDeltaSeconds]`，再应用：

```ts
nextPosition = mod(trackPosition + direction * speed * clampedDelta, track.length)
```

`reverseVehicle` 只把 `direction` 乘以 `-1`，重新派生朝向，绝不改变 `trackPosition` 或 `worldPosition`。

- [ ] **步骤 4：运行车辆及道路测试**

运行：`npm test -- src/game/vehicle.test.ts src/game/track.test.ts`

预期：全部通过。

- [ ] **步骤 5：提交车辆批次**

```bash
git add src/game/vehicle.ts src/game/vehicle.test.ts
git commit -m "feat: add track-relative vehicle movement"
```

### 任务 3：有向环距、抓捕与同步掉头事件

**文件：**

- 新建：`src/game/pursuit.ts`
- 修改：`src/game/engine.ts`
- 新建测试：`src/game/pursuit.test.ts`

**接口：**

- 消费：`advanceVehicle`、`reverseVehicle`、`Track`、`PursuitState` 和 `PursuitConfig`。
- 产出：`getThiefLead(policePosition: number, thiefPosition: number, direction: Direction, trackLength: number): number`。
- 产出：`getPoliceCatchGap(...相同参数): number`，返回同一有向弧长但明确表达追逐语义。
- 产出：`validatePursuitConfig(trackLength: number, config: PursuitConfig): void`。
- 产出：`stepPursuit(track: Track, state: PursuitState, deltaSeconds: number, config: PursuitConfig): PursuitState`。
- 产出：`createDebugPursuit(track: Track): { state: PursuitState; config: PursuitConfig }`。

- [ ] **步骤 1：写有向距离的失败测试**

```ts
it.each([
  { police: 10, thief: 40, direction: 1 as const, expected: 30 },
  { police: 40, thief: 10, direction: -1 as const, expected: 30 },
  { police: 95, thief: 5, direction: 1 as const, expected: 10 },
  { police: 5, thief: 95, direction: -1 as const, expected: 10 },
])('计算正反方向和跨零点的有向距离', ({ police, thief, direction, expected }) => {
  expect(getThiefLead(police, thief, direction, 100)).toBe(expected)
  expect(getPoliceCatchGap(police, thief, direction, 100)).toBe(expected)
})
```

- [ ] **步骤 2：运行有向距离测试并观察红灯**

运行：`npm test -- src/game/pursuit.test.ts`

预期：至少一个手算距离断言失败。

- [ ] **步骤 3：实现有向距离与配置校验**

两个语义函数均使用：

```ts
mod((thiefPosition - policePosition) * direction, trackLength)
```

配置校验拒绝非有限值以及不满足 `0 < catchDistance < reverseThreshold < L/2`、`reverseThreshold < 5*catchDistance`、负 cooldown/hysteresis、非正 `maxDeltaSeconds` 的配置。

- [ ] **步骤 4：写抓捕和快套圈不会误抓的失败测试**

用 `L=track.length`、`catchDistance=0.01L`、`reverseThreshold=0.1L` 构造状态，验证：

```ts
it('警察从正确追逐方向向下穿越 catchDistance 时抓捕', () => {
  const state = makeState({ lead: config.catchDistance + 2, policeSpeed: 30, thiefSpeed: 10 })
  const next = stepPursuit(track, state, 0.1, config)
  expect(next.captured).toBe(true)
  expect(getThiefLead(next.police.trackPosition, next.thief.trackPosition, next.police.direction, track.length))
    .toBeCloseTo(config.catchDistance, 7)
})

it('小偷接近套圈时即使二维位置接近也不触发抓捕', () => {
  const state = makeState({
    lead: track.length - config.reverseThreshold - 0.5,
    policeSpeed: 10,
    thiefSpeed: 20,
  })
  const next = stepPursuit(track, state, 0.01, config)
  expect(next.captured).toBe(false)
})
```

- [ ] **步骤 5：实现固定步内抓捕阈值穿越**

若 `relativeSpeed=thief.speed-police.speed < 0` 且当前 `lead>catchDistance`，计算：

```ts
catchTime = (lead - catchDistance) / (police.speed - thief.speed)
```

当 `catchTime` 位于本次限制后的 `dt` 内，双方仅推进到事件时刻并把 `captured` 设为 `true`；不以步末位置或二维距离判断，终止后不再推进。

- [ ] **步骤 6：写同步掉头、坐标连续和防抖的失败测试**

```ts
it('小偷向上穿越套圈阈值时双方恰好掉头一次', () => {
  const threshold = track.length - config.reverseThreshold
  const eventTime = 0.05
  const state = makeState({ lead: threshold - 1, policeSpeed: 10, thiefSpeed: 30 })
  const atEvent = stepPursuit(track, state, eventTime, config)

  expect(atEvent.reverseCount).toBe(1)
  expect(atEvent.police.direction).toBe(-1)
  expect(atEvent.thief.direction).toBe(-1)
  expect(atEvent.police.trackPosition).toBeCloseTo(state.police.trackPosition + 0.5, 7)
  expect(atEvent.thief.trackPosition).toBeCloseTo(state.thief.trackPosition + 1.5, 7)
  expect(atEvent.captured).toBe(false)
})

it('掉头动作本身不改变弧长位置和世界坐标', () => {
  const state = makeState({ lead: track.length - config.reverseThreshold, policeSpeed: 10, thiefSpeed: 30 })
  const next = stepPursuit(track, state, 0, config)
  expect(next.police.trackPosition).toBe(state.police.trackPosition)
  expect(next.thief.trackPosition).toBe(state.thief.trackPosition)
  expect(next.police.worldPosition).toEqual(state.police.worldPosition)
  expect(next.thief.worldPosition).toEqual(state.thief.worldPosition)
})

it('cooldown 与 armed 状态阻止连续多帧反复掉头', () => {
  const threshold = track.length - config.reverseThreshold
  const first = stepPursuit(track, makeState({ lead: threshold, policeSpeed: 10, thiefSpeed: 30 }), 0, config)
  const second = stepPursuit(track, first, 0.01, config)
  const third = stepPursuit(track, second, 0.01, config)
  expect([first.reverseCount, second.reverseCount, third.reverseCount]).toEqual([1, 1, 1])
})
```

- [ ] **步骤 7：实现精确掉头事件和 hysteresis 重置**

当 `relativeSpeed>0`、`reverseArmed=true` 且 `lead` 从下方抵达 `L-reverseThreshold` 时，计算：

```ts
reverseTime = (L - reverseThreshold - lead) / relativeSpeed
```

先推进到 `reverseTime`，再通过 `reverseVehicle` 原子翻转双方方向、设置完整 cooldown、`reverseArmed=false`、`reverseCount+1`，最后按新方向推进本步余时。每步衰减 cooldown；只有 cooldown 归零且新方向下的 `lead < L-reverseThreshold-reverseHysteresis` 时重新 armed。

- [ ] **步骤 8：运行追逐核心全部测试并做变异思考**

运行：`npm test -- src/game/pursuit.test.ts src/game/vehicle.test.ts src/game/track.test.ts`

预期：全部通过。人工检查以下错误都至少会使一个测试失败：方向符号反写、负数 `%` 未修正、用 `<=catchDistance` 无接近条件、掉头只翻一辆车、掉头修改位置、遗漏 cooldown、将近套圈当抓捕。

- [ ] **步骤 9：提交追逐批次**

```bash
git add src/game/pursuit.ts src/game/pursuit.test.ts src/game/engine.ts
git commit -m "feat: add directed pursuit events"
```

### 任务 4：原创 Canvas 调试预览

**文件：**

- 新建：`src/game/renderDebugScene.ts`
- 新建：`src/app/DebugChasePreview.tsx`
- 修改：`src/app/App.tsx`
- 修改测试：`src/app/App.test.tsx`
- 修改：`src/styles/global.css`

**接口：**

- 消费：`createDefaultTrack`、`createDebugPursuit`、`stepPursuit`。
- 产出：`renderDebugScene(context: CanvasRenderingContext2D, track: Track, state: PursuitState, viewport: {width:number;height:number}): void`。
- 产出：`DebugChasePreview` React 组件。

- [ ] **步骤 1：先更新应用结构失败测试**

```tsx
it('呈现可访问的临时追逐调试预览', () => {
  const markup = renderToStaticMarkup(<App />)
  expect(markup).toContain('<h1 id="project-title">Typing Gaming</h1>')
  expect(markup).toContain('闭环追逐调试预览')
  expect(markup).toContain('<canvas')
  expect(markup).toContain('aria-label="地图与车辆自动追逐画面"')
  expect(markup).not.toContain('textarea')
})
```

- [ ] **步骤 2：运行应用测试并确认缺少预览而失败**

运行：`npm test -- src/app/App.test.tsx`

预期：因调试标题或 Canvas 不存在而失败。

- [ ] **步骤 3：实现调试世界和 Canvas 绘制**

`createDebugPursuit` 使用 `catchDistance=0.01L`、`reverseThreshold=0.1L`、`reverseHysteresis=0.02L`、`reverseCooldownSeconds=0.75`、`maxDeltaSeconds=0.1`，初始有向领先约 `0.70L`。固定测试速度为警察 `L/30` 每秒、小偷 `L/12` 每秒，足以在约四秒后观察首次掉头；这些速度仅属于调试预览，不是正式 AI。

`renderDebugScene` 根据道路 bounds 计算固定全景相机，依次绘制：背景街区色块；沿部分道路样本法线外移的建筑、树木与路灯；宽道路边缘与虚线中心线；用圆、线段、圆角矩形现场绘制的两辆简约电动车。装饰数据由固定采样索引和算术模式确定，只传给绘制函数，不写入 `PursuitState`，不参与碰撞。

- [ ] **步骤 4：实现 React 动画循环和调试 HUD**

组件在 `useEffect` 内保存道路、世界和上一帧时间；每帧把 `(timestamp-lastTimestamp)/1000` 交给 `stepPursuit`，核心函数自行限制大 `dt`。按设备像素比调整画布后调用 renderer，并更新低频 HUD：当前方向、两车固定速度、有向领先、掉头次数和是否抓捕。卸载时取消 `requestAnimationFrame`。页面不创建输入框、文章、AI 或游戏状态机。

- [ ] **步骤 5：完成响应式 CSS 并运行应用测试**

Canvas 视觉区域使用 `aspect-ratio: 16/10`、`width:100%`，调试卡片最大宽度约 `76rem`；HUD 在窄屏自动换行。运行：`npm test -- src/app/App.test.tsx`，预期通过。

- [ ] **步骤 6：提交调试预览批次**

```bash
git add src/game/renderDebugScene.ts src/app/DebugChasePreview.tsx src/app/App.tsx src/app/App.test.tsx src/styles/global.css
git commit -m "feat: add canvas pursuit debug preview"
```

### 任务 5：浏览器验收与全量质量门禁

**文件：**

- 只在发现真实问题时修改任务 1—4 的相应文件和测试。

- [ ] **步骤 1：启动本地生产预览并做目视验收**

运行：`npm run build`，再运行 `npm run preview -- --host 127.0.0.1`。在浏览器打开 `http://127.0.0.1:4173/typing/`，连续观察至少一次自动掉头。

验收清单：道路闭合且明显曲折；无简单圆/椭圆外观；道路外有建筑、树和路灯；两车始终贴合道路；掉头瞬间位置连续、仅朝向改变；HUD 掉头计数只增加一次；页面在常见桌面和窄屏宽度不横向溢出；控制台无错误。

- [ ] **步骤 2：若目视验收发现缺陷，先新增最小回归测试再修复**

每个规则缺陷必须先在对应 `*.test.ts` 中复现；纯绘制缺陷在不改变规则 API 的前提下修复并重新目视检查。

- [ ] **步骤 3：运行完整检查并保存最新证据**

依次运行：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

预期：四条命令退出码均为 `0`，不得依据先前或截断输出宣称通过。

- [ ] **步骤 4：复核范围和 Git 状态**

运行 `git status --short`、`git diff --check`、`git diff --stat HEAD~4..HEAD`；确认没有实现打字、正式 AI、文章库或正式游戏 UI，没有第三方素材，且 `.gitignore` 的用户改动仍未暂存。

- [ ] **步骤 5：请求独立代码审查并处理有效问题**

审查重点：有向距离符号、跨零点、固定步事件顺序、掉头连续性、防抖重置、Canvas 与核心解耦、测试是否真实覆盖需求。若审查提出有效缺陷，遵循测试先行修复并重新运行四条全量检查。
