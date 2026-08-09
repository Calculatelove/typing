# AGENTS.md

## 目标

- 产品名称为 Typing Gaming。
- 本项目是纯单人网页打字追逐游戏，不实现联网、排行榜、账号系统或服务器。
- `docs/PRODUCT_SPEC.md` 是唯一有效的产品需求来源；其他设计和计划文档只记录决策与执行过程。

## 仓库结构

- `src/app/`：React 应用入口和页面级组件。
- `src/components/`：可复用 React UI 组件。
- `src/game/`：与 React、DOM 和 Canvas 解耦的核心游戏算法与状态。
- `src/input/`：英文输入、中文 IME 和 grapheme 处理。
- `src/articles/`：文章类型、目录和本地文章数据。
- `src/audio/`：Web Audio API 合成音效。
- `src/styles/`：全局和组件样式。
- `src/utils/`：不属于业务模块的通用纯函数。
- `docs/PRODUCT_SPEC.md`：产品需求的唯一权威来源。
- `docs/superpowers/specs/` 与 `docs/superpowers/plans/`：历史设计与实施记录，不覆盖产品规格。

## 实现约束

- 项目文档统一使用简体中文；命令、代码、路径、标识符、标准名称和产品明确要求的英文文案可以保留原文。
- React 负责菜单、文章区域、HUD 和结果界面；Canvas 负责地图、道路、装饰、车辆和追逐动画。
- 核心算法必须与 React 渲染和 Canvas 绘制解耦。
- 游戏逻辑尽量使用纯函数和可独立测试的 TypeScript 模块。
- 修改核心游戏机制时必须补充或更新自动测试。
- 不引入服务器端依赖。
- 不使用任何来源不明的图片、音乐、图标、字体或角色素材。
- 所有视觉素材必须原创，并通过 Canvas、CSS 或项目自己的 SVG 创建。
- 音效只能使用 Web Audio API 合成，或使用具有明确许可的原创资源。
- 不在产品 UI、代码注释、README、标识符或资源中提及作为玩法参考来源的现有产品名称。
- AI 不能读取玩家未来输入，不能根据即将输入的文章内容作弊。
- 不允许为了通过测试而删除、弱化或绕过产品需求。
- 部署目标为 GitHub Pages。
- Vite production base 为 `/typing/`；所有静态资源路径必须兼容 `/typing/` 子路径。
- 未经当前任务明确授权，不实现联网、文章远程加载、遥测或服务端功能。

## 子 Agent 协作

- 只有当前任务或适用技能明确要求时才使用子 Agent。
- 每个子任务必须有清晰范围、文件所有权和验收标准。
- 主 Agent 必须复核子 Agent 的 diff，并亲自运行相关验证；不得仅凭子 Agent 的完成声明交付。
- 不覆盖、删除或提交与当前任务无关的用户改动。

## 必须严格遵守的开发流程

1. 开始前阅读本文件和 `docs/PRODUCT_SPEC.md`，检查 Git 状态并保留无关改动。
2. 多步骤功能先写实施计划；新增功能或修复 bug 时遵循测试先行。
3. 先观察相关测试按预期失败，再写最小实现使其通过，然后重构。
4. 使用 `apply_patch` 修改文件，避免破坏性 Git 或文件系统操作。
5. 每轮任务完成前按顺序运行：
   - `npm test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
6. 只有读取完整、最新的命令输出并确认退出码为 0 后，才能宣称检查通过。
7. 提交只包含当前任务范围内的文件；不得提交 `node_modules/`、`dist/`、覆盖率输出、密钥或临时文件。
