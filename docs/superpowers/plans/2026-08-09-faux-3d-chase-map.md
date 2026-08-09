# 2.5D 大地图追逐视图实施计划

> **供智能开发者执行：** 必须使用 `superpowers:executing-plans` 在当前会话逐项实施；每项功能遵循测试先行。用户明确禁止本轮自行 commit 或 push，因此本计划用工作区检查点替代提交步骤。

**目标：** 在保持现有闭环道路与追逐数学接口稳定的前提下，建立明显大于视口的世界、可测试的斜投影和摄像机，并把开发预览升级为原创 2.5D 城市追逐场景。

**架构：** 二维世界坐标继续作为道路和车辆规则权威状态；新增纯函数配置、投影和摄像机模块。Canvas renderer 只消费 `Track`、`PursuitState` 与 `CameraState`，用统一高度方向绘制道路层次、环境和骑手电动车；React 只管理三种调试视图。

**技术栈：** TypeScript 6、React 19、Canvas 2D、Vitest 4、CSS、Vite 8。

## 全局约束

- 不改变有向距离、抓捕阈值穿越、套圈同步掉头、固定 60Hz 或 `dt` 上限语义。
- `catchDistance` 基于车辆规则长度和道路宽度，不直接依赖道路总长度 `L`。
- 摄像机前视使用车辆实际 `heading`，等价于道路 tangent 乘当前 `direction`。
- 地图坐标使用 `WORLD_SCALE=2.4`；车辆及骑手视觉尺寸不乘此比例。
- Play zoom 根据 viewport 与局部目标范围计算并 clamp，禁止 fit-to-map。
- 默认 `followThief`，并提供 `followPolice` 与 `overview`。
- 不引入 WebGL、外部图片、字体、图标、模型或参考图素材。
- 视觉必须明显呈现道路厚度、建筑屋顶和侧面、树木及路灯高度、骑手与电动车立体结构。
- 不实现打字、正式 AI、文章库、碰撞或正式 UI。
- 不 commit、不 push；保留工作区全部相关文档与代码变更。

---

## 文件结构

- 新建 `src/game/worldConfig.ts`：世界尺度、道路宽度、车辆规则/视觉尺寸和追逐配置。
- 新建 `src/game/worldConfig.test.ts`：地图尺度和抓捕距离独立性。
- 修改 `src/game/track.ts`：默认控制点应用 `WORLD_SCALE`，默认道路使用新宽度。
- 修改 `src/game/engine.ts` 与测试：使用独立追逐配置。
- 新建 `src/game/projection.ts` 与 `projection.test.ts`：斜投影、高度方向、投影 bounds 和 zoom。
- 新建 `src/game/camera.ts` 与 `camera.test.ts`：跟随目标、实际方向前视、双车构图和平滑。
- 重写 `src/game/renderDebugScene.ts`：分层 2.5D 道路、环境和骑手电动车。
- 修改 `src/app/DebugChasePreview.tsx`、`App.test.tsx` 和 `src/styles/global.css`：模式切换和默认 Play 视图。

## 任务 1：世界尺度和独立追逐距离

**接口：**

```ts
export const WORLD_SCALE = 2.4
export const DEFAULT_WORLD_ROAD_WIDTH = 120
export const VEHICLE_RULE_LENGTH = 72
export const VEHICLE_VISUAL = { length: 76, width: 30, riderHeight: 82 } as const
export function createWorldPursuitConfig(track: Pick<Track, 'length' | 'roadWidth'>): PursuitConfig
```

- [ ] **先写失败测试**

在 `worldConfig.test.ts` 验证：

```ts
it('路线变长但道路宽度不变时抓捕距离保持不变', () => {
  const short = createWorldPursuitConfig({ length: 5000, roadWidth: 120 })
  const long = createWorldPursuitConfig({ length: 12000, roadWidth: 120 })
  expect(long.catchDistance).toBe(short.catchDistance)
  expect(long.reverseThreshold).toBeGreaterThan(short.reverseThreshold)
  expect(long.reverseThreshold).toBeGreaterThanOrEqual(long.catchDistance * 5)
})

it('默认地图主要轴向大于旧世界的两倍', () => {
  const track = createDefaultTrack()
  expect(track.bounds.maxX - track.bounds.minX).toBeGreaterThan(2500)
  expect(track.bounds.maxY - track.bounds.minY).toBeGreaterThan(1900)
})
```

运行 `npm test -- src/game/worldConfig.test.ts src/game/engine.test.ts`，确认失败来自缺少配置和旧地图尺度。

- [ ] **实现最小配置并接入默认道路/引擎**

`createWorldPursuitConfig` 使用：

```ts
const catchDistance = Math.max(VEHICLE_RULE_LENGTH * 0.9, track.roadWidth * 0.42)
return {
  catchDistance,
  reverseThreshold: Math.max(track.length * 0.1, catchDistance * 5),
  reverseHysteresis: track.length * 0.02,
  reverseCooldownSeconds: 0.75,
  maxDeltaSeconds: 0.1,
}
```

默认控制点从未缩放基准数组通过 `.map(({x,y}) => ({x:x*WORLD_SCALE,y:y*WORLD_SCALE}))` 生成；`createDefaultTrack` 显式传入 `DEFAULT_WORLD_ROAD_WIDTH`。修改 `createDebugPursuit` 使用新配置，并更新旧测试中 `L*0.01` 假设。

- [ ] **运行相关测试**

运行 `npm test -- src/game/worldConfig.test.ts src/game/track.test.ts src/game/engine.test.ts src/game/pursuit.test.ts`，预期全部通过。

## 任务 2：统一斜投影和 Play/Overview zoom

**接口：**

```ts
export interface Viewport { readonly width: number; readonly height: number }
export interface CameraState { readonly position: Vector2; readonly zoom: number }
export interface ProjectionConfig { readonly verticalScale: number; readonly shearX: number; readonly heightVector: Vector2 }
export const DEFAULT_PROJECTION: ProjectionConfig
export function projectWorldPoint(world: Vector2, camera: CameraState, viewport: Viewport, height?: number): Vector2
export function projectWorldBounds(bounds: TrackBounds): TrackBounds
export function computePlayZoom(bounds: TrackBounds, viewport: Viewport): number
export function computeOverviewCamera(bounds: TrackBounds, viewport: Viewport, padding?: number): CameraState
```

- [ ] **先写失败测试**

`projection.test.ts` 使用手算值验证：

```ts
it('把摄像机原点投到视口中心并斜压世界 Y', () => {
  const camera = { position: { x: 10, y: 20 }, zoom: 2 }
  expect(projectWorldPoint({ x: 10, y: 20 }, camera, { width: 800, height: 600 }))
    .toEqual({ x: 400, y: 300 })
  expect(projectWorldPoint({ x: 10, y: 120 }, camera, { width: 800, height: 600 }))
    .toEqual({ x: 432, y: 444 })
})

it('Play zoom 最多显示地图约四成且绝不等于全图 zoom', () => {
  const bounds = { minX: -1400, minY: -1000, maxX: 1400, maxY: 1000 }
  const viewport = { width: 1200, height: 750 }
  const play = computePlayZoom(bounds, viewport)
  const overview = computeOverviewCamera(bounds, viewport).zoom
  expect(play).toBeGreaterThan(overview * 2)
})
```

高度测试验证同一 world 输入对象不被修改，且 `height=80` 的屏幕点相对地面向左上移动。

- [ ] **实现投影纯函数**

使用 `verticalScale=0.72`、`shearX=0.16`、高度方向 `(-0.28,-1)`。Play zoom 取宽/高目标比例所需 zoom 的较大值，再 clamp 到 `0.45..1.4`；overview 仅以投影 bounds 和 padding fit。

- [ ] **运行投影测试**

运行 `npm test -- src/game/projection.test.ts`，预期全部通过。

## 任务 3：摄像机目标、实际方向和帧率无关平滑

**接口：**

```ts
export type CameraMode = 'followThief' | 'followPolice' | 'overview'
export function createPlayCamera(track: Track, state: PursuitState, mode: Exclude<CameraMode, 'overview'>, viewport: Viewport): CameraState
export function getPlayCameraTarget(state: PursuitState, mode: Exclude<CameraMode, 'overview'>, viewport: Viewport, zoom: number): Vector2
export function updatePlayCamera(camera: CameraState, state: PursuitState, mode: Exclude<CameraMode, 'overview'>, viewport: Viewport, deltaSeconds: number): CameraState
```

- [ ] **先写实际方向与构图失败测试**

`camera.test.ts` 构造真实道路车辆，验证：

- 正向时目标点在车辆 heading 前方。
- `reverseVehicle` 后目标偏移向量与掉头前点积小于零。
- 另一车位于可见宽度 `40%` 时，目标比单车目标更靠近两车中点；距离超过可见宽度时不混合。
- `dt=0` 不移动；一次 `0.1s` 与两次 `0.05s` 的结果在容差内一致。

运行 `npm test -- src/game/camera.test.ts`，确认缺少行为而失败。

- [ ] **实现摄像机**

前向量必须由 `Math.cos(player.heading)`、`Math.sin(player.heading)` 得到，不从未带方向的 tangent 单独推导。前视距离为可见世界高度的 `16%..24%`；近车混合上限 `0.35`；位置平滑 `tau=0.32s`，渲染 `dt` clamp 到 `0.1s`。zoom 每帧使用 `computePlayZoom`，不根据两车间距缩至全图。

- [ ] **运行摄像机和追逐回归测试**

运行 `npm test -- src/game/camera.test.ts src/game/vehicle.test.ts src/game/pursuit.test.ts`，预期全部通过。

## 任务 4：2.5D Canvas 环境和骑手电动车

**文件：** 修改 `src/game/renderDebugScene.ts`。

**接口：**

```ts
export interface RenderSceneOptions {
  readonly camera: CameraState
  readonly mode: CameraMode
}
export function renderDebugScene(context: CanvasRenderingContext2D, track: Track, state: PursuitState, viewport: Viewport, options: RenderSceneOptions): void
```

- [ ] **先写应用集成失败测试**

更新 `App.test.tsx`，要求页面存在三个按钮，默认小偷按钮为 `aria-pressed="true"`，Canvas 标签仍存在，且不出现输入框。运行该测试确认旧页面失败。

- [ ] **重写 renderer 分层**

必须实现：

- 投影后的低对比街区网格和地面色块。
- 道路阴影、路肩下沿、路肩顶面、沥青、高光边线和投影虚线。
- 建筑 ground footprint、两组可见侧面、屋顶和窗户。
- 树木地面阴影、树干和分层树冠。
- 路灯基座、立杆、灯臂、灯头和光点。
- 装饰与车辆按地面投影 Y 排序，并对 Play 视口外对象宽松裁剪。
- 使用独立 `VEHICLE_VISUAL` 绘制前后车轮、踏板侧面/顶面、前立杆、车把、骑手腿/身体/头部和阴影。
- Police 使用蓝青白和抽象双色警示灯；Thief 使用橙紫深灰和背包；不得出现汽车车身。

道路、装饰、车辆的屏幕点全部通过 `projectWorldPoint`；不得用旧 renderer 的全图 `createCamera` 或顶视 `context.rotate(vehicle.heading)` 直接画色块。

- [ ] **运行类型检查和相关测试**

运行 `npm test -- src/app/App.test.tsx && npm run typecheck`，修复所有接口错误。

## 任务 5：React 三模式预览和浏览器验收

**文件：** 修改 `src/app/DebugChasePreview.tsx`、`src/styles/global.css`。

- [ ] **接入模式按钮和摄像机生命周期**

页面状态默认 `followThief`。按钮使用 `type="button"` 和 `aria-pressed`；切换 follow 模式保留摄像机位置并平滑跟随，进入 overview 立即调用 `computeOverviewCamera`，从 overview 返回 Play 时调用 `createPlayCamera`。模式切换不得重建 `PursuitFrameState`。

每帧先推进固定步追逐，再更新摄像机，最后调用 renderer。HUD 增加“当前视图”，标题说明默认是局部追逐视野。

- [ ] **运行全量自动检查**

依次运行：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

- [ ] **浏览器目视验收**

默认桌面 Play 模式验收：看不到完整道路；地图平移需要约 2～3 个视口覆盖；小偷摄像机平滑且前方留白；首次同步掉头后前视反转而位置不跳；两辆车近距离时尽量同框。

切换跟随警察，确认模拟和掉头次数不重置；切换全图 Debug，确认完整道路可见并明确标注 Debug；返回 Play，确认恢复局部视图。

视觉阻断清单：建筑必须同时有屋顶和侧面；道路至少四层；树木/路灯有高度；两名骑手与电动车结构可辨；若画面只是放大的顶视图，则继续迭代而不交付。

在 390px 窄屏重复检查模式按钮、局部视野、电动车可辨性和无横向溢出。读取控制台，要求无 error/warn。

- [ ] **最终范围复核**

运行 `git diff --check` 和 `git status --short`；确认所有变更保持未提交，没有外部资源、WebGL、打字、正式 AI 或文章库实现。
