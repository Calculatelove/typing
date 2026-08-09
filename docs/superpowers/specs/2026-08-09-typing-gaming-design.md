# Typing Gaming 设计规格

**状态：** 已确认  
**确认日期：** 2026-08-09  
**选定架构：** 方案 1——一维环形弧长模型作为权威游戏状态，Canvas 负责二维投影和渲染。

## 0. 当前工程基线

第 0 轮首次检查时，本地目录尚未初始化为 Git 仓库，目录内只有 `AGENTS.md`、`prompt-my.md` 和 `prompt-gpt.md` 三份规划资料，没有前端脚手架、依赖清单、源代码、测试或部署配置。

在本规格落盘前，目录已经由外部初始化为 `main` 分支，并配置远程 `git@github.com:Calculatelove/typing.git`；当时还没有历史提交，`.gitignore` 和 `AGENTS.md` 均为未跟踪的用户文件。现有提示词文件是需求来源资料，不自动成为产品 UI、README 或正式代码内容。后续第一阶段仍需建立工程骨架，并在操作远程仓库前核对权限和线上状态。

## 1. 产品范围

Typing Gaming 是纯单人网页打字追逐游戏。游戏中只有警察和小偷，双方驾驶原创简约风格的电动车。玩家选择其中一方，AI 控制另一方。

- 玩家作为小偷：在文章输入完成前避免被 AI 警察抓到；文章完成且仍未被抓到则胜利。
- 玩家作为警察：在文章输入完成前抓到 AI 小偷；文章完成仍未抓到则失败。
- 不实现联网、排行榜、账号、服务器或多人模式。

开始游戏前允许选择：

- 玩家身份：警察或小偷
- 语言：英文或简体中文
- 难度：简单、普通、困难或影子
- 文章长度：短、中或长
- 文章选择：指定文章或在筛选结果中随机选择
- 按键音开关
- 错误提示音开关

## 2. 原创与依赖约束

- 产品名称只使用 Typing Gaming。
- 产品 UI、README、代码注释、变量名、资源名和正式产品文档不得出现作为玩法参考来源的现有产品名称。
- 不下载、复制、临摹或重新打包现有游戏的图片、音乐、角色、地图、图标、模型或音效。
- 场景、道路、建筑、车辆和装饰由 Canvas、CSS 或项目自有 SVG 现场绘制。
- 音效由 Web Audio API 合成，除非以后获得可验证的明确许可。
- 不引入来源或许可证不明的第三方素材。
- 第三方开发库只承担工程功能，不提供游戏美术、声音或文章内容。

## 3. 技术架构

采用 Vite、React、TypeScript、HTML Canvas、Vitest 和 CSS。

- React：设置页、文章区域、HUD、结果页、可访问性和输入焦点管理。
- Canvas：地图、道路、装饰、车辆、摄像机和追逐动画。
- TypeScript 核心模块：道路、车辆、追逐距离、掉头、抓捕、速度、AI 和状态机。
- Vitest：核心算法、输入判定、状态机、AI、内容验证和确定性模拟。
- 后期以少量真实浏览器测试覆盖页面集成和 GitHub Pages 子路径。

核心模块禁止依赖 React、DOM 或 Canvas。Canvas 渲染器读取核心状态快照，但不得决定车辆位置、抓捕或胜负。React 通过事件向核心引擎提交设置和输入结果，并订阅只读快照。

游戏模拟采用固定时间步；浏览器渲染帧率只影响画面插值，不影响规则结果。

## 4. 推荐目录结构

```text
/
├── docs/
│   ├── PRODUCT_SPEC.md
│   └── superpowers/
│       ├── specs/
│       └── plans/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── screens/
│   ├── components/
│   ├── game/
│   │   ├── core/
│   │   │   ├── types.ts
│   │   │   ├── config.ts
│   │   │   ├── math.ts
│   │   │   ├── track.ts
│   │   │   ├── vehicle.ts
│   │   │   ├── pursuit.ts
│   │   │   ├── speedModel.ts
│   │   │   ├── ai.ts
│   │   │   ├── stateMachine.ts
│   │   │   └── engine.ts
│   │   └── render/
│   │       ├── canvasRenderer.ts
│   │       ├── camera.ts
│   │       └── sceneGeometry.ts
│   ├── input/
│   │   ├── typingSession.ts
│   │   ├── inputAdapter.ts
│   │   └── graphemes.ts
│   ├── articles/
│   │   ├── types.ts
│   │   ├── catalog.ts
│   │   └── data/
│   ├── audio/
│   ├── styles/
│   └── main.tsx
├── tests/
│   ├── integration/
│   └── browser/
├── .github/workflows/
├── vite.config.ts
├── vitest.config.ts
└── package.json
```

算法单元测试优先与源文件相邻放置，跨模块测试进入 `tests/integration`。不创建用于保存第三方静态素材的资源目录。

## 5. 状态机

主状态：

- `setup`：玩家选择本局设置。
- `ready`：地图、文章和车辆已初始化；车辆与计时冻结；输入入口已聚焦。
- `running`：第一次正确有效输入后开始车辆运动和比赛计时。
- `won`：玩家胜利，模拟冻结。
- `lost`：玩家失败，模拟冻结。

状态转换：

- `setup --START--> ready`
- `ready --FIRST_CORRECT_INPUT--> running`
- `running --TERMINAL_EVENT--> won | lost`
- `won | lost --RETRY--> ready`
- `won | lost --BACK_TO_SETUP--> setup`

胜负矩阵：

| 玩家身份 | 抓捕发生 | 文章完成且未抓捕 |
|---|---|---|
| 小偷 | 失败 | 胜利 |
| 警察 | 胜利 | 失败 |

输入事件使用与模拟一致的单调时钟排队。抓捕和文章完成时间相同时，抓捕优先。终止状态不可被后续事件改写。

浏览器进入后台时暂停模拟时钟并丢弃累计的过长帧时间；返回前台后从零积压继续。此行为不增加正式的玩家暂停功能。

## 6. 环形道路模型

道路由原创控制点形成闭合 Catmull–Rom 曲线，不使用简单圆形或椭圆。构建时先进行密集参数采样，再生成累计弧长查找表。

道路数据包括：

- 控制点
- 道路宽度
- 总弧长 `L`
- 采样点数组
- 每个采样点的弧长、二维坐标、单位切线和单位法线
- 世界边界
- 装饰生成种子
- 只参与渲染的建筑、树木和灯柱数据

`sampleAt(s)` 先把任意正负弧长规范到 `[0,L)`，再二分查找相邻样本并插值世界坐标和朝向。

地图构建检查：

- 曲线首尾位置和切线连续
- 不存在不可接受的尖角
- 不存在造成视觉歧义的道路自交
- 不相邻路段之间保留足够间距
- 装饰不遮挡主要道路且不参与碰撞

## 7. 车辆和有向追逐距离

每辆车的权威状态包括角色、环形弧长位置 `s`、非负实际速度、目标速度和可选的调试统计。世界坐标与朝向从道路采样派生，不作为规则权威数据。

双方始终同向行驶和同时掉头，因此世界状态只保存一个权威方向：

```text
direction ∈ {+1, -1}
```

安全取模定义：

```text
mod(x, L) = ((x % L) + L) % L
```

位置更新：

```text
s' = mod(s + direction × speed × dt, L)
```

小偷沿当前方向领先警察的距离：

```text
lead = mod(direction × (thiefPosition - policePosition), L)
```

- `lead` 接近零：小偷位于警察前方，警察可能完成抓捕。
- `lead` 接近 `L`：小偷接近领先整圈，虽然二维坐标也可能很近，但不能判定为被抓。

抓捕、套圈和掉头禁止使用二维欧氏距离。初始位置满足：

```text
catchDistance < initialLead < L - reverseThreshold
```

## 8. 快套圈掉头与抓捕

参数约束：

```text
0 < catchDistance < reverseThreshold < L / 2
reverseThreshold >= 5 × catchDistance
```

首轮调参范围：

- `catchDistance`：`0.5%L` 至 `1.5%L`
- `reverseThreshold`：`8%L` 至 `12%L`

小偷到警察的后向剩余距离：

```text
rearGap = mod(direction × (policePosition - thiefPosition), L)
```

当小偷比警察快，并且 `lead` 从下方穿越 `L - reverseThreshold` 时触发掉头。不能仅按“当前处于阈值区间”触发。

固定时间步内的处理顺序：

1. 根据本步开始距离和相对速度求阈值穿越时刻。
2. 将双方推进到穿越时刻。
3. 原子执行 `direction = -direction`。
4. 保持双方弧长位置不变，因此世界坐标不瞬移。
5. 用新方向推进本时间步剩余部分。

在阈值处掉头后，新方向下的 `lead` 约等于 `reverseThreshold`，小偷重新位于警察前方。

掉头防抖同时使用：

- 仅响应从阈值外向阈值内的穿越。
- 掉头后短暂 cooldown。
- cooldown 结束并退出带 hysteresis 的触发区后重新 armed。

抓捕只在以下条件满足时发生：

- `lead` 从大于 `catchDistance` 向下穿越该阈值。
- 警察相对小偷正在接近，即 `policeSpeed - thiefSpeed > epsilon`。
- 本时间片中没有更早发生的掉头事件。

模拟使用 60 Hz 固定步长。每个渲染帧限制最大补算步数；过长后台积压直接丢弃。若一个固定步内可能穿越规则边界，必须求交点时间，不能依赖步末位置。

## 9. 中文 IME 与输入判定

英文和中文统一通过保持焦点的原生 `textarea` 接收输入，React 单独渲染已完成、当前和剩余文章。

事件规则：

- `compositionstart`：进入组合状态。
- `compositionupdate`：只保留候选信息，不计分。
- 组合期间的 `input`：更新 DOM 缓冲，不计分。
- `compositionend`：结束组合状态，但不直接计分。
- 随后的第一个 `isComposing=false` 的 `input`：处理正式提交文本。
- 若浏览器缺失最终 `input`，微任务读取尚未消费的缓冲作为降级处理。
- 每个缓冲版本只能消费一次，防止重复计数。

文章和提交文本统一进行 NFC 规范化。字符分割首选 `Intl.Segmenter` 的 grapheme 模式；fallback 按 Unicode code point 遍历。文章库禁止 Emoji、组合字符和异常控制字符，以保证 fallback 不产生明显差异。

一次提交多个 grapheme 时：

1. 逐个与目标位置比较。
2. 正确前缀正常推进并记录时间戳。
3. 第一个错误产生一次错误事件。
4. 错误后的本次提交内容丢弃。
5. 错误不回退已有正确进度。

粘贴、拖放、自动更正、自动大写和拼写替换关闭。`keydown` 只处理快捷键，不承担中文字符判定。

## 10. 玩家动态速度

维护最近三秒的正确计分 grapheme 时间戳队列。

设：

- 滚动窗口 `W = 3s`
- 窗口内正确计分单位数为 `N`
- 观测时长 `D = max(1s, min(3s, now - runningStartedAt))`

英文表现率：

```text
performanceRate = (N / 5) × (60 / D)
```

中文表现率：

```text
performanceRate = N × (60 / D)
```

英文计分单位包含必须输入的字母、标点和空格；中文包含必须输入的汉字和标点。文章长度验证复用同一计分函数。

基础速度按道路总长缩放：

```text
baseSpeed = (L / 90s) × (performanceRate / 50)
```

目标速度：

```text
targetSpeed = baseSpeed × comboMultiplier × errorPenalty × idleMultiplier
```

首轮配置：

- 表现率计算上限约 140。
- 连击倍率从 `1.0` 渐近增长到 `1.10`，错误或明显空闲时重置。
- 错误惩罚即时降到约 `0.55`，随后约 `0.7s` 指数恢复。
- 最后一次正确输入后约 `0.75s` 开始空闲衰减。
- 连续空闲约 `4s` 后速度直接归零。
- 应用全部倍率后的速度上限约为 `L / 34s`。

实际速度使用帧率无关指数平滑：

```text
actual += (target - actual) × (1 - exp(-dt / tau))
```

- 加速时间常数：约 `0.25s` 至 `0.35s`
- 减速时间常数：约 `0.10s` 至 `0.18s`

减速快于加速，使错误反馈明确。所有数值集中配置，并在自动模拟阶段校准。

## 11. AI 统一参数模型

所有难度共用一个 AI 控制器。统一状态包括当前和目标表现率、当前和目标速度、下次更新时间、临时行为状态、带种子的伪随机数生成器以及影子模式历史更新时间。

| 难度 | 每局平均表现率 | 常规波动 | 目标更新间隔 | 临时行为 |
|---|---:|---:|---:|---|
| 简单 | 25～35 | 约 ±5 | 1.2～2.5 秒 | 较明显停顿或降速 |
| 普通 | 40～55 | 约 ±3 | 2～4 秒 | 少量轻微变化 |
| 困难 | 60～80 | 约 ±2 | 3～5 秒 | 偶发 5%～10% 短加速 |
| 影子 | 玩家过去五秒 | ±2%～3% | 固定五秒 | 无随机停顿和强加速 |

普通三档在每局开始时从平均区间选取中心值，后续围绕中心产生有界目标。停顿、降速和加速使用同一临时状态结构，概率和倍率来自难度参数。

影子模式：

- 只读取已经发生的五秒玩家表现历史。
- 每五秒更新一次目标。
- 历史不足时使用中性初始值 45。
- 不读取目标字符、剩余文章、未来输入或未来文章状态。
- 跟随原始表现率，不复制玩家连击和错误惩罚。

AI 和玩家使用同一个表现率到基础车辆速度映射。测试采用固定 seed；正式局记录 seed 以便复现。

## 12. 文章模型

最终文章库规模：

- 英文短、中、长各 20 篇，共 60 篇。
- 中文短、中、长各 20 篇，共 60 篇。
- 合计 120 篇。

每篇字段：

- `id`
- `title`
- `language`
- `length`
- `text`
- `scoredGraphemeCount`
- `wordCount`
- `estimatedSecondsAt50`
- `sourceType`
- `sourceLabel`
- `sourceUrl`
- `license`
- `tags`

长度目标：

| 档位 | 50 表现率预计时长 | 英文词数 | 中文计分 grapheme |
|---|---:|---:|---:|
| 短 | 约 2 分钟 | 90～110 | 90～110 |
| 中 | 约 4 分钟 | 190～210 | 190～210 |
| 长 | 约 6 分钟 | 290～310 | 290～310 |

文章优先全部编写为原创练习文本。原创内容的来源标签统一说明为 Typing Gaming 原创练习文本；URL 和许可证为空。只有能可靠确认公共领域或开放许可证时才允许加入外部文本，并完整记录来源 URL 和许可证。

随机文章先按语言和长度筛选，再从筛选结果中选择，不能跨筛选范围。

## 13. 自动测试策略

### 道路与追逐数学

- 正负取模和跨越 `s=0`
- 曲线闭合、弧长单调、首尾切线连续
- 正反方向有向距离
- 警察追上与小偷快套圈的区分
- 掉头一次、坐标不变、方向同步
- cooldown 和 hysteresis 防止反复掉头
- 固定时间步内穿越阈值不漏事件
- 不同渲染 FPS 下模拟结果一致

### 输入与速度

- 英文逐字符验证
- 多种中文 composition/input 事件顺序
- 一次提交多个字符
- 正确前缀和首次错误
- 三秒窗口淘汰旧记录
- 稳定 30、50、80 表现率
- 高频 burst、连击上限、错误恢复、空闲归零和最高速度
- 重复组合事件不重复计数

### AI 与状态机

- 四档参数范围
- 相同 seed 完全复现
- 长时间模拟的均值和波动范围
- 简单档波动显著高于困难档
- 影子每五秒更新且只读取历史
- 两种身份的胜负矩阵
- 抓捕与文章完成同刻时抓捕优先
- 终止事件幂等

### 内容与浏览器

- 文章数量、长度档、唯一 ID 和来源字段
- 正式计分函数与内容统计一致
- NFC、控制字符和重复内容检查
- 随机选择遵守筛选范围
- 后期增加少量真实浏览器冒烟测试覆盖设置、输入、Canvas、重开和 `/typing/` 子路径

Canvas 不以大量像素快照作为主要测试。真实系统 IME 最终在 Chrome、Edge 和 Safari 手动验收。

## 14. GitHub Pages 部署

- Vite production `base` 为 `/typing/`。
- 保持单页无路由结构，避免刷新依赖服务端路由。
- 静态资源使用 Vite import 或 `import.meta.env.BASE_URL`。
- 禁止硬编码 `/assets/...` 和 localhost URL。
- `dist` 由 CI 生成，不提交到 Git。

GitHub Actions 在 `main` push 和 `workflow_dispatch` 时运行：

1. checkout
2. 安装锁定的 Node 版本
3. `npm ci`
4. test、typecheck、lint、build
5. configure Pages
6. 上传 `dist` Pages artifact
7. 独立 deploy job 部署到 `github-pages` environment

部署任务使用最小权限：`contents: read`、`pages: write`、`id-token: write`。配置 Pages concurrency，避免旧部署覆盖新部署。

仓库设置选择 `Settings → Pages → Build and deployment → Source → GitHub Actions`。目标地址为：

```text
https://calculatelove.github.io/typing/
```

部署实现以 GitHub Pages 自定义工作流和 Vite 静态部署的官方文档为准：

- <https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>
- <https://vite.dev/guide/static-deploy.html>

## 15. 分阶段实施

1. 规格固化、Git/Vite/React/TypeScript/Vitest 工程骨架和质量脚本。
2. 环形地图、车辆、固定时间步、抓捕和掉头核心，以及调试预览。
3. 英文/中文输入、IME、grapheme 和玩家动态速度。
4. 四档统一 AI、身份、状态机和胜负。
5. 设置页、游戏页、HUD、结果页、Canvas 场景和 Web Audio 合成音效。
6. 60 篇原创英文文章及验证。
7. 60 篇原创中文文章及验证。
8. 自动玩家模拟、数值平衡和极端场景验证。
9. 原创视觉、响应式、性能和无障碍打磨。
10. CI、GitHub Pages 部署和线上验收。

每阶段以可测试交付物为边界，修改核心规则时必须先增加或更新测试。阶段结束运行 test、typecheck、lint 和 production build。

本规格覆盖完整产品，但实施计划按上述阶段分别编写和审批。第一个实施计划只覆盖阶段 1，不把文章库、完整游戏 UI 或部署提前混入工程骨架任务。

## 16. 主要风险及已选处理方式

1. **环形距离语义混淆：** 只使用有向弧长和阈值穿越方向判断，不用二维距离。
2. **IME 重复或漏提交：** 使用组合状态、缓冲版本和单次消费规则。
3. **时间基准不统一：** 输入、AI、滚动窗口和模拟统一使用单调时钟；规则采用固定时间步。
4. **终局事件竞争：** 核心状态机集中仲裁，同刻抓捕优先，终止状态不可改写。
5. **文章统计与输入规则不一致：** 内容验证复用正式 NFC 和 grapheme 计分函数。

## 17. 验收条件

- 两种玩家身份均可完成一整局并正确判定胜负。
- 英文逐字符输入和中文 IME 正式提交均不会重复计分。
- 玩家速度来自最近约三秒表现，而不是文章总进度。
- 四档 AI 共用一套逻辑，表现符合各自区间，影子只读取历史。
- 抓捕、跨零点、快套圈和同时掉头在正反方向均正确。
- 页面没有联网、账号、服务器或排行榜功能。
- 所有视觉和声音均为项目现场生成的原创内容。
- 120 篇文章数量、长度、来源和唯一性验证通过。
- test、typecheck、lint 和 production build 全部通过。
- GitHub Pages 在 `/typing/` 子路径正常运行，静态资源无 404。
