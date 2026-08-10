# Typing Gaming 正式游戏页面、设置、HUD 与音效实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用正式 Setup、Game、Result 页面接入现有核心游戏，并加入 12 篇 fixture、设置持久化、HUD、结果统计和 Web Audio 合成音效。

**Architecture:** `App` 管理三页面流和已解析文章；纯模块负责文章、设置、统计和音色计划；`useGameRound` 只把 React 事件、Canvas 与现有固定时间步核心接线。调试预览保留但不再作为正式入口。

**Tech Stack:** React 19、TypeScript 6、HTML Canvas 2D、Web Audio API、Vitest、CSS、Vite

## Global Constraints

- `docs/PRODUCT_SPEC.md` 是唯一产品需求来源。
- Vite production base 保持 `/typing/`。
- 不引入路由、服务端、网络、遥测或外部媒体素材。
- React 负责设置、文章、HUD 和结果；Canvas 负责场景。
- AI、追逐、输入和速度核心接口保持纯函数边界。
- 所有新增行为先观察失败测试，再写最小实现。
- 本轮使用 12 篇原创 fixture，不生成最终 120 篇文章。
- 未经用户明确要求，不创建提交或推送。

---

### Task 1: Fixture 文章目录与选择

**Files:**
- Create: `src/articles/types.ts`
- Create: `src/articles/fixtures.ts`
- Create: `src/articles/catalog.ts`
- Create: `src/articles/catalog.test.ts`
- Modify: `src/articles/index.ts`

**Interfaces:**
- Produces: `Article`、`ArticleLanguage`、`ArticleLength`
- Produces: `FIXTURE_ARTICLES`
- Produces: `filterArticles(articles, language, length)`
- Produces: `findArticleById(articles, id)`
- Produces: `selectRandomArticle(articles, language, length, random)`

- [ ] **Step 1: 写 12 篇组合、唯一性、元数据和过滤失败测试**

```ts
expect(FIXTURE_ARTICLES).toHaveLength(12)
expect(filterArticles(FIXTURE_ARTICLES, 'english', 'short')).toHaveLength(2)
expect(filterArticles(FIXTURE_ARTICLES, 'chinese', 'long')).toHaveLength(2)
expect(new Set(FIXTURE_ARTICLES.map((article) => article.id)).size).toBe(12)
expect(FIXTURE_ARTICLES.every((article) => article.sourceType === 'original-fixture')).toBe(true)
```

- [ ] **Step 2: 运行 `npm test -- src/articles/catalog.test.ts`，确认模块缺失或行为失败**

- [ ] **Step 3: 定义完整文章类型并编写原创 fixture**

每篇在模块加载时使用正式 `segmentGraphemes` 计算 `scoredGraphemeCount`，英文用空白词边界计算 `wordCount`，并据语言计算 `estimatedSecondsAt50`。

- [ ] **Step 4: 写 Random Article 受限池和边界随机值失败测试**

```ts
expect(selectRandomArticle(FIXTURE_ARTICLES, 'english', 'short', () => 0)?.id)
  .toBe(filterArticles(FIXTURE_ARTICLES, 'english', 'short')[0].id)
expect(selectRandomArticle(FIXTURE_ARTICLES, 'english', 'short', () => 0.999)?.id)
  .toBe(filterArticles(FIXTURE_ARTICLES, 'english', 'short')[1].id)
```

- [ ] **Step 5: 实现过滤、ID 查找和 clamp 后的可注入随机选择**
- [ ] **Step 6: 运行文章测试并保持全绿**

### Task 2: 设置模型与 localStorage 降级

**Files:**
- Create: `src/app/settings.ts`
- Create: `src/app/settings.test.ts`
- Create: `src/app/types.ts`

**Interfaces:**
- Consumes: `ArticleLanguage`、`ArticleLength`、`AiDifficulty`、`PlayerRole`
- Produces: `GameSettings`、`DEFAULT_GAME_SETTINGS`
- Produces: `loadSettings(storage, articles)`
- Produces: `saveSettings(storage, settings)`
- Produces: `normalizeSettings(candidate, articles)`

- [ ] **Step 1: 写默认值、完整 round-trip 和损坏 JSON 失败测试**

```ts
expect(loadSettings(emptyStorage, FIXTURE_ARTICLES)).toEqual(DEFAULT_GAME_SETTINGS)
saveSettings(memoryStorage, hardChineseSettings)
expect(loadSettings(memoryStorage, FIXTURE_ARTICLES)).toEqual(hardChineseSettings)
memoryStorage.setItem(SETTINGS_STORAGE_KEY, '{broken')
expect(loadSettings(memoryStorage, FIXTURE_ARTICLES)).toEqual(DEFAULT_GAME_SETTINGS)
```

- [ ] **Step 2: 运行设置测试并确认失败**
- [ ] **Step 3: 实现字段白名单验证、try/catch 存储适配和默认设置**
- [ ] **Step 4: 写语言/长度变化导致旧文章 ID 失效的失败测试**

```ts
expect(normalizeSettings({...defaults, language: 'chinese'}, FIXTURE_ARTICLES).selectedArticleId)
  .toBe(filterArticles(FIXTURE_ARTICLES, 'chinese', 'short')[0].id)
```

- [ ] **Step 5: 实现筛选池内文章 ID 修复并运行测试**

### Task 3: 结果统计与音频合成边界

**Files:**
- Create: `src/game/roundStats.ts`
- Create: `src/game/roundStats.test.ts`
- Replace: `src/audio/index.ts`
- Create: `src/audio/synth.ts`
- Create: `src/audio/synth.test.ts`

**Interfaces:**
- Produces: `createRoundStats()`、`recordRoundMotion(stats, speed, dt)`、`computeAccuracy(correct, errors)`、`finalizeRoundStats()`
- Produces: `TypingSoundKind`、`TONE_PLANS`、`createTypingAudio()`

- [ ] **Step 1: 写 Accuracy、速度积分、零时长和完成时间失败测试**

```ts
expect(computeAccuracy(0, 0)).toBe(1)
expect(computeAccuracy(9, 1)).toBe(0.9)
const result = finalizeRoundStats(recordRoundMotion(createRoundStats(), 120, 2), 9, 1)
expect(result.averageSpeed).toBe(120)
expect(result.completionSeconds).toBe(2)
```

- [ ] **Step 2: 运行统计测试并确认失败，再实现纯累计器**
- [ ] **Step 3: 写正确/错误音色和独立开关路由失败测试**

```ts
expect(TONE_PLANS.correct.frequencyHz).toBeGreaterThan(TONE_PLANS.error.frequencyHz)
audio.play('correct', { keySoundEnabled: false, errorSoundEnabled: true })
expect(factory.createdContexts).toBe(0)
audio.play('error', { keySoundEnabled: false, errorSoundEnabled: true })
expect(factory.createdContexts).toBe(1)
```

- [ ] **Step 4: 实现延迟 AudioContext、oscillator/gain 包络和静默失败**
- [ ] **Step 5: 运行统计与音频测试并保持全绿**

### Task 4: Setup、HUD、文章和 Result 组件

**Files:**
- Create: `src/components/SetupScreen.tsx`
- Create: `src/components/ArticleDisplay.tsx`
- Create: `src/components/GameHud.tsx`
- Create: `src/components/ResultScreen.tsx`
- Create: `src/components/components.test.tsx`
- Modify: `src/components/index.ts`

**Interfaces:**
- Consumes: `GameSettings`、`Article`、`GameResult`
- Produces: `SetupScreen`、`ArticleDisplay`、`GameHud`、`ResultScreen`

- [ ] **Step 1: 写 Setup SSR 失败测试**

```ts
expect(markup).toContain('Typing Gaming')
expect(markup).toContain('Player Role')
expect(markup).toContain('Police')
expect(markup).toContain('Choose Article')
expect(markup).toContain('Key Sound')
```

- [ ] **Step 2: 写文章当前字符、HUD 字段和 Result 按钮失败测试**

```ts
expect(articleMarkup).toContain('article-display__current')
expect(hudMarkup).toContain('Accuracy')
expect(resultMarkup).toContain('Victory')
expect(resultMarkup).toContain('再来一次')
expect(resultMarkup).toContain('返回设置')
```

- [ ] **Step 3: 运行组件测试并确认失败**
- [ ] **Step 4: 实现语义化、无业务判断的展示组件**
- [ ] **Step 5: 运行组件测试并保持全绿**

### Task 5: 正式游戏运行 Hook 与 Game 页面

**Files:**
- Create: `src/app/useGameRound.ts`
- Create: `src/components/GameScreen.tsx`
- Modify: `src/game/engine.ts` only if the existing prepare/finalize callback cannot satisfy正式接线

**Interfaces:**
- Consumes: `ResolvedRound`、输入模块、AI、gameplay、camera、renderDebugScene、roundStats、typing audio
- Produces: `UseGameRoundResult`，包含 canvas/input refs、输入处理器、typing state、HUD、game phase 和结果
- Produces: `GameScreen({ round, onComplete })`

- [ ] **Step 1: 写正式页面静态结构失败测试**

```ts
expect(markup).toContain('aria-label="Typing Gaming game world"')
expect(markup).toContain('aria-label="文章输入"')
expect(markup).not.toContain('全图 Debug')
```

- [ ] **Step 2: 运行测试并确认失败**
- [ ] **Step 3: 从 Debug 预览接线模式实现 `useGameRound`**

固定步顺序为：记录当前表现历史、计算玩家速度、推进 AI、用 `prepareGameplayStep` 分配速度、推进追逐、用 `finalizeGameplayStep` 解析终局、累计玩家实际速度。输入提交产生正确/错误事件后更新 typing state、播放对应音效，并在首个正确事件时进入 running。

- [ ] **Step 4: 保证完成回调仅触发一次，并构造 `GameResult`**

```ts
if (terminal && !resultDeliveredRef.current) {
  resultDeliveredRef.current = true
  onComplete({ outcome, stats, article, settings })
}
```

- [ ] **Step 5: 实现 GameScreen Canvas、文章、textarea 和 HUD 组合**
- [ ] **Step 6: 运行 App、组件及全部核心定向测试**

### Task 6: 顶层三页面流、正式视觉和浏览器验收

**Files:**
- Modify: `src/app/App.tsx`
- Rewrite: `src/app/App.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `loadSettings`、`saveSettings`、`selectRandomArticle`、三页面组件
- Produces: 正式 `Setup -> Game -> Result` 流程

- [ ] **Step 1: 写 App 默认 Setup 和页面流辅助函数失败测试**
- [ ] **Step 2: 实现设置保存、文章解析、round key、Retry 与返回设置**
- [ ] **Step 3: 重写 CSS 为正式桌面/移动端布局，保留 Canvas 2.5D 原创视觉**
- [ ] **Step 4: 运行 `npm test`**
- [ ] **Step 5: 运行 `npm run typecheck`**
- [ ] **Step 6: 运行 `npm run lint`**
- [ ] **Step 7: 运行 `npm run build`**
- [ ] **Step 8: 浏览器检查两身份×四难度可启动、筛选、Random、声音、结果、Retry、返回设置和 390px 布局**
- [ ] **Step 9: 运行 `git diff --check` 并保留未提交工作区**
