# Typing Gaming 输入与玩家动态速度设计

**状态：** 用户第 3 轮需求已明确确认
**日期：** 2026-08-09

## 1. 范围

本轮实现英文逐 grapheme 输入、中文 IME 正式提交去重、最近三秒表现率、玩家目标速度与实际速度，并把结果接入现有追逐开发预览。只使用一组本地调试文本，不实现正式文章库、AI、设置页或胜负界面。

## 2. 模块边界

- `src/input/graphemes.ts`：NFC 规范化与 grapheme 分割。优先使用 `Intl.Segmenter`；无法使用时按 Unicode code point 分割。
- `src/input/typingSession.ts`：保存目标 grapheme、正确位置、正确/错误计数、连击和时间戳；只消费正式提交文本。
- `src/input/imeInput.ts`：DOM 无关的 IME 事件状态机。组合期间不产生提交；最终 `input` 或缺失最终事件时的微任务 fallback 最多提交一次。
- `src/game/rollingTypingPerformance.ts`：只保存最近三秒的正确时间戳，并按语言计算表现率。
- `src/game/speedConfig.ts`：集中保存窗口、表现上限、连击、错误、空闲、平滑和速度映射参数。
- `src/game/speedModel.ts`：从当前表现快照计算目标速度，并以帧率无关指数平滑更新实际速度。
- `src/app/DebugChasePreview.tsx`：负责 textarea、文章进度和 Debug HUD；不实现输入算法。

## 3. 输入状态与事件

`TypingSessionState` 保存：目标 grapheme、`correctIndex`、`correctCount`、`errorCount`、`combo`、`lastCorrectAt`、`lastErrorAt` 和 `correctTimestamps`。`applyCommittedText` 按 grapheme 顺序比较：正确前缀逐个推进并产生 correct event；遇到首个错误只产生一个 error event、连击归零并丢弃该提交剩余内容。

IME reducer 使用显式 `pendingComposition` 版本：

1. `compositionstart` 标记组合中。
2. `compositionupdate` 和组合期间 `input` 只更新缓冲，不提交。
3. `compositionend` 建立待提交版本但不计分，并安排微任务 fallback。
4. 随后的非组合 `input` 消费该版本并取消 fallback。
5. 若最终 `input` 缺失，fallback 消费同一版本；迟到的同文本最终事件只清除抑制标记，不再次提交。

英文输入和粘贴走普通非组合 `input`，每个事件作为新提交处理。React 成功消费后清空 textarea，视觉文章不依赖 textarea 内容。

## 4. Ready 与 Running

开发预览初始为 `ready`，车辆和追逐计时冻结。错误、组合候选和空提交都不启动游戏；首个 correct event 使用其单调时间戳设置 `runningStartedAt` 并进入 `running`。本轮默认玩家为小偷，警察继续使用固定调试速度。

## 5. 表现率

窗口为三秒；查询时淘汰 `timestamp < now - 3` 的旧记录。观测时长 `D=max(1,min(3,now-runningStartedAt))`。

- English：`N / 5 / D × 60`，HUD 显示 `WPM`。
- 中文：`N / D × 60`，HUD 显示 `字/分钟`。

表现率限制在 `0..140`。burst 可以迅速提高近期值，但旧记录在窗口外不再贡献；算法不读取文章总进度。

## 6. 速度模型

所有参数位于 `speedConfig.ts`：基准表现率 `50`，基准单圈时间 `90s`，速度上限 `L/34s`；连击最高 `1.10`；错误倍率从 `0.55` 以 `0.7s` 时间常数恢复；最后正确输入 `0.75s` 后开始空闲衰减，并在持续空闲 `4s` 时归零。

```text
baseSpeed = (L / 90) × clamp(performanceRate, 0, 140) / 50
targetSpeed = min(L / 34, baseSpeed × comboMultiplier × errorPenalty × idleMultiplier)
```

连击只提供有限线性加成，达到配置上限后不再增长。目标速度为零时允许车辆最终停下。实际速度使用指数平滑；加速 `tau=0.30s`，减速 `tau=0.14s`，`dt` 限制到 `0.1s`。错误通过目标速度立刻下降并配合较短减速 tau 产生明显反馈。

## 7. Debug 集成

页面保留三种摄像机视图，并新增：语言切换、调试文章、保持焦点的 textarea、阶段、recent performance、target speed、actual speed、combo、idle state、error penalty 和输入错误数。语言切换重置本轮调试输入及追逐状态，不加载文章库。

## 8. 测试与验收

纯函数测试覆盖 grapheme fallback、正确前缀/首错停止、IME 标准顺序与 fallback 去重、稳定 30/50/80、burst、三秒淘汰、错误恢复、连击上限、空闲归零、最大速度和不同 FPS。React 静态测试覆盖 textarea 与 HUD 文案。浏览器验收覆盖英文实际输入启动、速度变化、错误反馈、摄像机模式不重置输入，以及窄屏布局；真实中文候选输入仍按产品规格在 Chrome、Edge、Safari 最终手工验收。

## 9. 自审结论

- 没有使用文章总进度计算速度。
- IME 组合文本不会进入输入会话。
- 时间全部使用秒制暂停感知模拟时间；正式输入、IME fallback、滚动窗口、空闲判定和固定步速度更新共用同一时间线，后台恢复或长帧丢弃不会把输入写成未来事件。
- 核心模块不依赖 React、DOM 或 Canvas。
- 未加入第三方素材、服务端依赖、文章库或正式 AI。
