# Typing Gaming 正式游戏页面、设置、HUD 与音效设计

**状态：** 用户已确认方案 A

**日期：** 2026-08-09

## 1. 范围

本轮把现有地图、输入、动态速度、AI、身份和胜负状态机接入正式三页面流程。使用 12 篇原创 fixture 文章验证筛选和游戏流程，不生成最终 120 篇文章，不增加联网、账号、排行榜、遥测或第三方素材。

## 2. 页面架构

顶层 `App` 使用显式页面状态管理：

```text
Setup -> Game -> Result
          ^        |
          | Retry  |
          +--------+
```

- `SetupScreen`：编辑并保存设置、筛选文章、启动本局。
- `GameScreen`：Canvas、文章输入、HUD 和固定时间步运行时。
- `ResultScreen`：胜负与最终统计、相同配置重试、返回设置。
- `useGameRound`：封装 React 与现有纯核心模块的接线，不承担追逐、AI 或胜负算法。

不增加路由依赖。`DebugChasePreview` 保留为开发组件，但正式 `App` 不再渲染它。

## 3. 设置和持久化

设置结构包含：

- `playerRole`: `PLAYER_POLICE | PLAYER_THIEF`
- `language`: `english | chinese`
- `difficulty`: `easy | normal | hard | shadow`
- `length`: `short | medium | long`
- `articleMode`: `choose | random`
- `selectedArticleId`
- `keySoundEnabled`
- `errorSoundEnabled`

使用 `typing-gaming.settings.v1` 保存到 localStorage。加载模块逐字段验证；JSON 损坏、存储不可用、枚举值非法或指定文章失效时使用安全默认值。默认设置为小偷、English、Normal、Short、Choose Article、两个声音均开启。

语言或长度变化后，如果当前文章不再属于筛选结果，自动选择第一个有效条目。Random Article 只在点击开始时从当前 `language + length` 结果中选择一次，本局内保持固定。

## 4. Fixture 文章

创建 12 篇原创 fixture：两种语言乘三种长度，每组 2 篇。Short、Medium、Long 大致符合最终长度范围并复用正式 grapheme 计分规则。

元数据沿用产品规格完整结构：`id`、`title`、`language`、`length`、`text`、计分数量、词数、50 表现率预计时间、来源类型、来源标签、来源 URL、许可证和标签。来源明确标记为 Typing Gaming 原创 fixture，不伪造外部链接。

文章模块提供纯函数过滤、ID 查找和可注入随机源的选择函数。

## 5. 正式设置页

设置页显示产品名称和一句简短说明。身份、语言、难度、长度、文章方式和音效使用语义化按钮或开关，并保留清晰焦点。

Choose Article 显示当前筛选结果的文章卡片，包含标题、长度和来源。Random Article 显示当前筛选池数量及说明，不提前泄露最终随机结果。开始按钮验证筛选池非空后进入游戏。

桌面使用双栏卡片布局，移动端改为单栏，不依赖固定像素宽度。

## 6. 正式游戏页

游戏页从上到下为：紧凑局信息栏、大型 Canvas、文章面板、输入入口和 HUD。Canvas 是视觉主体，文章面板紧邻场景并保持清晰可读。

文章面板独立渲染已正确部分、醒目的当前 grapheme 和剩余部分。错误时触发短暂颜色与边框脉冲；边框宽度、内边距和最小高度固定，避免布局跳动。

原生 textarea 继续负责英文输入和中文 IME，关闭粘贴、拖放、自动改写和拼写替换。进入 ready 自动聚焦；首次正确输入进入 running；终局后禁用输入。

正式模式不显示全图 Debug 或摄像机切换。摄像机始终跟随当前玩家，沿实际行驶方向前视，另一辆车接近时继续使用现有双车构图。此轮不增加 minimap。

## 7. HUD

HUD 显示：

- 玩家身份
- Difficulty
- 当前表现率及语言单位
- Accuracy
- Combo
- Article progress
- 游戏状态
- 简化有向追逐距离

Accuracy 定义为：

```text
correct / (correct + errors) * 100%
```

没有输入时显示 100%。文章进度使用正确 grapheme 数除以总 grapheme 数，只用于 UI，不控制车辆速度。

## 8. 音效

音效仅使用 Web Audio API 实时合成，延迟到用户输入手势后创建 `AudioContext`。

- 正确：低音量、柔和的短高音。
- 错误：更低、更短的提示音。
- 中文一次 IME commit 即使含多个正确 grapheme，也只播放一次正确音。
- 一次错误事件只播放一次错误音。
- Key Sound 与 Error Sound 完全独立。
- 不加载任何外部音频文件。

合成参数和事件路由分离。纯函数生成音色计划，浏览器适配器负责 oscillator/gain，方便无浏览器单元测试。

## 9. 结果统计

游戏运行时按固定步累计玩家实际速度积分：

```text
averageSpeed = sum(actualSpeed * fixedDt) / runningSeconds
```

最终统计包含：胜负、平均实际速度、Accuracy、错误次数、从 running 到终局的完成时间和文章信息。平均速度只用于展示，不反馈给实时速度模型。

“再来一次”使用相同设置和同一篇已解析文章创建全新局；“返回设置”保留持久设置并回到 Setup。

## 10. 错误和边界处理

- localStorage 读写异常不阻止游戏，只退回内存默认值。
- Random Article 空池时禁止开始并显示稳定错误文案。
- AudioContext 不可用或被浏览器拒绝时静默禁用本次播放，不影响输入和模拟。
- 页面隐藏时继续依赖现有 delta 上限和固定步最大补算，避免恢复时跃迁。
- 终止状态只产生一次结果，React 重渲染不得重复导航。

## 11. 测试和浏览器验收

自动测试覆盖：

- 12 篇 fixture 的组合数量、ID、长度、来源和计分元数据。
- 语言/长度过滤、指定文章、受限随机选择。
- 设置序列化、损坏数据降级和失效文章 ID。
- Accuracy、速度积分、完成时间和结果快照。
- 音色计划及两个独立开关的事件路由。
- Setup、Game、Result 的可访问静态结构。
- 两身份、四难度启动配置与原有核心测试回归。

浏览器手工检查两种身份与四种难度均能开始；中英文、三长度、Choose/Random、两个声音开关、胜负结果、Retry、返回设置和移动端布局可用。

## 12. 非目标

- 不生成最终 120 篇文章。
- 不增加 minimap、路由、服务端、网络或遥测。
- 不更换现有追逐、AI、输入和摄像机数学。
- 不下载图片、音频、字体或其他素材。
