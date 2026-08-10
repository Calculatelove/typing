# Typing Gaming AI、身份与胜负状态机实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用一套可复现、参数驱动的 AI 控制器实现四档难度，并集中管理玩家身份、局级阶段和胜负。

**Architecture:** 将历史表现、AI 控制和游戏状态机拆成三个纯 TypeScript 模块。AI 与玩家共享基础速度映射，React 调试页只在固定时间步中接线，不接触胜负规则。

**Tech Stack:** TypeScript、React、HTML Canvas、Vitest、CSS

## Global Constraints

- `docs/PRODUCT_SPEC.md` 是唯一产品需求来源。
- 四档难度必须共用一个控制器，只改变集中参数。
- AI 只读取当前模拟时间、自身状态和已经发生的玩家历史。
- 模拟继续使用 60 Hz 固定时间步。
- 抓捕与文章完成同一时间精度内发生时抓捕优先。
- 核心算法与 React、DOM 和 Canvas 解耦。
- 本轮不实现正式文章库、完整设置页、结果页、音效或联网功能。
- 未经用户再次明确要求，不创建提交或推送。

---

### Task 1: 共享速度映射与历史表现

**Files:**
- Create: `src/game/performanceHistory.ts`
- Create: `src/game/performanceHistory.test.ts`
- Modify: `src/game/speedModel.ts`
- Modify: `src/game/speedModel.test.ts`

**Interfaces:**
- Produces: `performanceRateToBaseSpeed(trackLength, performanceRate): number`
- Produces: `appendPerformanceSample(history, sample, now): PerformanceHistory`
- Produces: `averageHistoricalPerformance(history, now, windowSeconds): number | undefined`

- [ ] **Step 1: 写共享映射失败测试**

```ts
expect(performanceRateToBaseSpeed(trackLength, 50)).toBeCloseTo(trackLength / 90)
expect(computePlayerTargetSpeed(playerAt50).baseSpeed).toBeCloseTo(
  performanceRateToBaseSpeed(trackLength, 50),
)
```

- [ ] **Step 2: 运行 `npm test -- src/game/speedModel.test.ts`，确认因导出不存在而失败**

- [ ] **Step 3: 抽取映射并让玩家模型复用**

```ts
export function performanceRateToBaseSpeed(trackLength: number, performanceRate: number): number {
  const length = Math.max(0, finiteOrZero(trackLength))
  const rate = clamp(finiteOrZero(performanceRate), 0, PLAYER_SPEED_CONFIG.maximumPerformanceRate)
  return Math.min(
    length / PLAYER_SPEED_CONFIG.maximumLapSeconds,
    length / PLAYER_SPEED_CONFIG.referenceLapSeconds
      * rate / PLAYER_SPEED_CONFIG.referencePerformanceRate,
  )
}
```

- [ ] **Step 4: 写历史窗口失败测试**

```ts
const history = createPerformanceHistory([
  { timestamp: 1, rate: 30 },
  { timestamp: 3, rate: 50 },
  { timestamp: 7, rate: 999 },
])
expect(averageHistoricalPerformance(history, 5, 5)).toBe(40)
```

- [ ] **Step 5: 运行 `npm test -- src/game/performanceHistory.test.ts`，确认模块缺失失败**

- [ ] **Step 6: 实现有界历史与未来样本过滤**

历史只保留有限、非负且 `timestamp <= now` 的样本；平均值按样本所覆盖的固定时间间隔加权，窗口无有效样本时返回 `undefined`。

- [ ] **Step 7: 运行 Task 1 两个测试文件并保持全绿**

### Task 2: 统一四档 AI 控制器

**Files:**
- Replace: `src/game/ai.ts`
- Create: `src/game/ai.test.ts`

**Interfaces:**
- Consumes: `performanceRateToBaseSpeed()`、`averageHistoricalPerformance()`
- Produces: `AI_DIFFICULTY_CONFIG`
- Produces: `createAiController(difficulty, seed, now, trackLength): AiControllerState`
- Produces: `stepAiController(state, input): AiControllerState`

- [ ] **Step 1: 写四档参数和 seed 复现失败测试**

```ts
expect(Object.keys(AI_DIFFICULTY_CONFIG)).toEqual(['easy', 'normal', 'hard', 'shadow'])
expect(simulate('easy', 1234)).toEqual(simulate('easy', 1234))
expect(simulate('easy', 1234)).not.toEqual(simulate('easy', 5678))
```

- [ ] **Step 2: 运行 `npm test -- src/game/ai.test.ts`，确认空 AI 模块导致失败**

- [ ] **Step 3: 实现纯 seeded PRNG、集中参数和 AI 初始状态**

PRNG 每次返回 `{ value, state }`；配置包含长期区间、常规波动、目标间隔、表现平滑常数、临时事件概率、倍率和持续时间。

- [ ] **Step 4: 写普通三档时间变化、easy/hard 波动和困难短加速失败测试**

```ts
expect(targetsAfterChanges(easy).variance).toBeGreaterThan(targetsAfterChanges(hard).variance)
expect(findTemporaryState(hard, 'boost').endsAt - boostStartedAt).toBeLessThanOrEqual(0.8)
expect(hardBoostMultiplier).toBeGreaterThanOrEqual(1.05)
expect(hardBoostMultiplier).toBeLessThanOrEqual(1.1)
```

- [ ] **Step 5: 运行测试，确认行为断言失败**

- [ ] **Step 6: 用单一 `stepAiController` 实现目标切换和临时状态**

每步先结束过期临时状态，再在 `nextTargetChangeTime` 到达时通过当前难度参数生成目标及可选临时状态，最后指数平滑 `currentPerformanceRate` 并更新 `targetSpeed/currentSpeed`。

- [ ] **Step 7: 写影子五秒更新和未来隔离失败测试**

```ts
expect(stepAt(4.99).targetPerformanceRate).toBe(45)
expect(stepAt(5).targetPerformanceRate).toBeCloseTo(historyAverage, 0)
expect(stepShadow(historyPrefix)).toEqual(stepShadow([...historyPrefix, futureSample]))
```

- [ ] **Step 8: 运行测试并确认 shadow 断言失败**

- [ ] **Step 9: 实现影子专用五秒目标更新分支**

影子分支不进入普通随机目标和临时事件路径；历史缺失时使用 45，只对历史平均叠加 ±2.5% 内 seeded 扰动。

- [ ] **Step 10: 运行 `npm test -- src/game/ai.test.ts` 并保持全绿**

### Task 3: 身份与胜负状态机

**Files:**
- Create: `src/game/gameSession.ts`
- Create: `src/game/gameSession.test.ts`

**Interfaces:**
- Produces: `GamePhase`、`PlayerRole`、`GameSessionState`、`GameSessionEvent`
- Produces: `createGameSession(config): GameSessionState`
- Produces: `transitionGameSession(state, event): GameSessionState`

- [ ] **Step 1: 写 setup、ready、首次正确输入失败测试**

```ts
const setup = createGameSession({ playerRole: 'thief', difficulty: 'normal' })
expect(setup.phase).toBe('setup')
expect(transitionGameSession(setup, { type: 'prepare' }).phase).toBe('ready')
expect(transitionGameSession(ready, { type: 'firstCorrectInput' }).phase).toBe('running')
```

- [ ] **Step 2: 运行 `npm test -- src/game/gameSession.test.ts`，确认模块缺失失败**

- [ ] **Step 3: 实现显式事件和合法阶段迁移**

非法阶段事件原样返回；重新配置事件创建新的 `setup`，`prepare` 才进入 `ready`。

- [ ] **Step 4: 写两身份、同帧优先和终止幂等失败测试**

```ts
expect(resolve(thief, { captured: true, articleCompleted: false })).toBe('lost')
expect(resolve(thief, { captured: false, articleCompleted: true })).toBe('won')
expect(resolve(police, { captured: true, articleCompleted: false })).toBe('won')
expect(resolve(police, { captured: false, articleCompleted: true })).toBe('lost')
expect(resolve(thief, { captured: true, articleCompleted: true })).toBe('lost')
expect(transitionGameSession(won, laterLoss)).toBe(won)
```

- [ ] **Step 5: 运行测试并确认终局断言失败**

- [ ] **Step 6: 实现集中终局解析，先判断抓捕再判断文章完成**

- [ ] **Step 7: 运行 `npm test -- src/game/gameSession.test.ts` 并保持全绿**

### Task 4: 固定时间步与调试预览接入

**Files:**
- Modify: `src/app/DebugChasePreview.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/global.css`
- Create: `src/game/gameplay.ts`
- Create: `src/game/gameplay.test.ts`

**Interfaces:**
- Consumes: `createAiController()`、`stepAiController()`、`transitionGameSession()`
- Preserves: `advancePursuitFrame()`、追逐数学、输入和摄像机接口
- Produces: `prepareGameplayStep()`、`finalizeGameplayStep()`，供 React 与自动测试共同使用

- [ ] **Step 1: 扩展 App 静态测试，要求身份、四档难度、AI HUD 和重试入口存在**

```ts
expect(source).toContain('PLAYER_THIEF')
expect(source).toContain('PLAYER_POLICE')
expect(source).toContain('影子')
expect(source).toContain('AI target performance')
expect(source).toContain('重新开始')
```

- [ ] **Step 2: 运行 `npm test -- src/app/App.test.tsx`，确认新断言失败**

- [ ] **Step 3: 接入身份、难度、AI 与状态机 refs**

第一次正确输入发送 `firstCorrectInput`。每个固定时间步记录玩家表现、更新 AI、把玩家和 AI 速度写入各自角色，再推进追逐；步后把 `captured` 和文章完成事实一起发送给状态机。

- [ ] **Step 4: 更新调试控制、HUD、摄像机默认玩家跟随和终局冻结**

切换身份或难度、点击重试时统一重建追逐、输入、AI、历史和状态机并回到 `ready`。

- [ ] **Step 5: 运行 App 测试、AI 测试、状态机测试和现有 pursuit/engine 测试**

### Task 5: 最终验证

**Files:**
- Modify: `docs/PRODUCT_SPEC.md` only if implementation reveals a missing authoritative decision

- [ ] **Step 1: 运行 `npm test`，要求所有测试通过**
- [ ] **Step 2: 运行 `npm run typecheck`，要求退出码 0**
- [ ] **Step 3: 运行 `npm run lint`，要求退出码 0**
- [ ] **Step 4: 运行 `npm run build`，要求退出码 0**
- [ ] **Step 5: 浏览器检查四档切换、两种身份、ready 启动、终局冻结与重试**
- [ ] **Step 6: 运行 `git diff --check` 并汇总结果；不创建提交或推送**
