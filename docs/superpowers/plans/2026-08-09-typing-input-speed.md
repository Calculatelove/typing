# Typing Gaming 输入与动态速度实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现英文/中文正式输入判定、三秒滚动表现率和可接入追逐模拟的玩家动态速度，并在开发预览中提供可观察 HUD。

**Architecture:** 浏览器事件先由 DOM 无关 IME reducer 去重，再将正式提交交给不可变 typing session；正确时间戳进入独立滚动窗口，速度模型只读取近期表现、连击与最近事件时间。React 管理焦点和调试展示，核心输入及速度算法不依赖 React、DOM 或 Canvas。

**Tech Stack:** React 19、TypeScript 6、Vitest 4、HTML textarea、Intl.Segmenter、CSS、Oxlint。

## Global Constraints

- `docs/PRODUCT_SPEC.md` 是唯一产品需求来源；专项设计不得覆盖它。
- 不使用文章总进度决定速度，不实现文章库、正式 AI 或完整游戏 UI。
- 中文候选组合期间不得计入正确或错误；一个 composition 缓冲版本最多消费一次。
- 所有输入文本 NFC 规范化，优先 `Intl.Segmenter`，fallback 按 Unicode code point。
- 所有时间戳和持续时间统一使用秒，并以固定步累加的暂停感知模拟时钟作为输入与速度的共同时间线。
- 核心算法不得依赖 React、DOM、Canvas 或浏览器全局。
- 所有速度参数集中在 `src/game/speedConfig.ts`。
- 保留现有地图、摄像机、追逐、抓捕和掉头接口及测试。
- 不引入第三方依赖、服务端功能或外部素材。
- 当前工作树含第 2 轮未提交成果；本轮不得 commit、push、重置或覆盖无关改动。
- 每个生产行为必须先观察对应测试因行为缺失而失败。
- 完成前依次运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`。

---

## Task 1：Grapheme 与输入会话

**Files:**
- Create: `src/input/graphemes.ts`
- Create: `src/input/graphemes.test.ts`
- Create: `src/input/typingSession.ts`
- Create: `src/input/typingSession.test.ts`
- Modify: `src/input/index.ts`

**Interfaces:**
- Produces: `normalizeInputText(text: string): string`。
- Produces: `segmentGraphemes(text: string, segmenter?: Pick<Intl.Segmenter, 'segment'> | null): string[]`。
- Produces: `createTypingSession(targetText: string): TypingSessionState`。
- Produces: `applyCommittedText(state, text, timestamp): TypingCommitResult`。

- [ ] 写失败测试：NFC 规范化、英文逐字符、中文多 grapheme、fallback code point、正确前缀后首错停止、错误不推进、连击与时间戳。
- [ ] 运行 `npm test -- src/input/graphemes.test.ts src/input/typingSession.test.ts`，确认失败原因是 API/行为缺失。
- [ ] 实现最小 grapheme 与不可变输入会话；每个正确 grapheme 使用同一 commit 时间戳入队，首错后丢弃剩余内容。
- [ ] 重跑两个测试文件并保持通过。

## Task 2：IME 组合与重复事件防护

**Files:**
- Create: `src/input/imeInput.ts`
- Create: `src/input/imeInput.test.ts`

**Interfaces:**
- Produces: `createImeInputState(): ImeInputState`。
- Produces: `reduceImeInput(state, event): ImeInputResult`。
- Produces: `consumeImeFallback(state, version): ImeInputResult`。
- `ImeInputResult` 返回新状态、可选正式 `committedText` 和可选 `fallbackVersion`。

- [ ] 写失败测试：组合 update/input 不提交；compositionend 后 final input 只提交一次；缺 final input 时 fallback 提交；fallback 后迟到 input 不重复；普通英文 input 立即提交。
- [ ] 运行 `npm test -- src/input/imeInput.test.ts` 并观察正确红灯。
- [ ] 实现显式 pending version 与一次性迟到事件抑制。
- [ ] 重跑测试并确认全部通过。

## Task 3：三秒滚动表现率

**Files:**
- Create: `src/game/speedConfig.ts`
- Create: `src/game/rollingTypingPerformance.ts`
- Create: `src/game/rollingTypingPerformance.test.ts`

**Interfaces:**
- Produces: `TypingLanguage = 'english' | 'chinese'`。
- Produces: `createRollingTypingPerformance(language, runningStartedAt?)`。
- Produces: `recordCorrectInput(state, timestamp, count?)`。
- Produces: `getRecentPerformance(state, now): { state; rate; recentCount; observationSeconds }`。

- [ ] 用手算时间戳写失败测试：英文稳定 30/50/80 WPM、中文等值字/分钟、高频 burst 上限、三秒窗口淘汰、未启动为零。
- [ ] 运行该测试文件确认行为缺失红灯。
- [ ] 实现有序时间戳队列、三秒淘汰、`D=max(1,min(3,now-start))` 和 `0..140` 上限。
- [ ] 重跑并确认稳定数值与窗口边界通过。

## Task 4：目标速度与帧率无关平滑

**Files:**
- Modify: `src/game/speedModel.ts`
- Create: `src/game/speedModel.test.ts`

**Interfaces:**
- Produces: `computePlayerTargetSpeed(input): PlayerSpeedSnapshot`，包含 `performanceRate`、`baseSpeed`、`comboMultiplier`、`errorPenalty`、`idleMultiplier`、`idle`、`targetSpeed`。
- Produces: `smoothPlayerSpeed(actualSpeed, targetSpeed, deltaSeconds): number`。

- [ ] 写失败测试：30/50/80 单调映射、performance 0、error penalty 立即出现并恢复、combo cap、idle decay、持续空闲归零、max speed cap。
- [ ] 写不同 FPS 测试：用 30/60/144 FPS 平滑相同一秒，结果在容差内一致。
- [ ] 运行测试确认 API/行为缺失。
- [ ] 实现集中配置、倍率计算、速度 cap 与加减速不同 tau 的指数平滑。
- [ ] 重跑速度测试并保持通过。

## Task 5：React Debug 输入与追逐接线

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/DebugChasePreview.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: typing session、IME reducer、rolling performance、speed model。
- Produces: ready/running 开始规则、英文/中文调试文本、textarea、视觉进度与扩展 HUD。

- [ ] 先修改静态 React 测试，要求 textarea、ready/running 文案、recent performance、target/actual speed、combo、idle、error penalty 和语言切换存在；运行并观察失败。
- [ ] 在组件内以 ref 保存高频算法状态；事件处理只把 reducer 的 `committedText` 交给 typing session，compositionend 使用 `queueMicrotask` fallback。
- [ ] 第一次 correct event 才设置 running；ready 时不调用追逐推进；running 时把平滑实际速度写入默认玩家小偷快照后推进。
- [ ] 语言切换重建输入与调试追逐状态；模式按钮只切摄像机，不重置输入。
- [ ] 增加可访问焦点、文章状态和响应式 HUD 样式，重跑 App 测试及全部输入/速度测试。

## Task 6：浏览器与最终验证

**Files:**
- No production files unless a failing browser observation first receives a regression test.

- [ ] 启动本地 Vite，桌面输入正确英文，确认 ready→running、recent/target/actual speed 上升、停止后 idle 和速度下降。
- [ ] 输入错误字符，确认文章不推进、错误数增加且 error penalty 立即下降。
- [ ] 切换摄像机模式，确认输入进度和追逐状态不重置。
- [ ] 在 390×844 检查 textarea、文章进度与 HUD 无横向溢出。
- [ ] 读取浏览器 console warning/error；真实系统中文候选输入留给产品规格规定的 Chrome/Edge/Safari 最终手工验收。
- [ ] 依次运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`，再运行 `git diff --check`。
- [ ] 发起只读代码审查，修复所有 Critical/Important 后重新执行完整验证。

## Plan Self-Review

- 规格第 9 节由 Task 1、2、5 覆盖。
- 规格第 10 节和用户列出的所有速度测试由 Task 3、4 覆盖。
- ready 首次正确输入、Debug HUD 和实际追逐接线由 Task 5 覆盖。
- 中文 composition 不重复、不同 FPS、burst、窗口淘汰和最终归零均有明确红灯步骤。
- 文件接口名称在所有任务中一致；没有 TBD、TODO、占位步骤或本轮 commit 操作。
