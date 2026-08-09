# Typing Gaming 项目基础实施计划

> **面向 Agent 工作者：** 必须使用子技能 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项执行本计划。步骤使用复选框（`- [ ]`）跟踪。

**目标：** 建立可靠的 Vite、React、TypeScript、Vitest、CSS 和代码检查基础，并提供项目级长期约束、唯一产品规格、可测试的模块边界和最小初始化页面。

**架构：** React 负责当前占位 UI 以及未来菜单和 HUD；`src/game` 预留给与框架无关的 TypeScript 逻辑，Canvas 渲染在后续阶段加入。Vitest 在 Node 环境运行行为测试，TypeScript 项目引用分别检查应用和工具配置，Vite 将所有生产 URL 构建到 `/typing/` 子路径下。

**技术栈：** Node.js 22.12+、npm、Vite 8、React 19、TypeScript 6、Vitest 4、Oxlint、CSS。

## 全局约束

- 产品名称为 Typing Gaming。
- 产品为单人游戏，不包含联网、账号、排行榜或服务器依赖。
- React 负责 UI，Canvas 负责游戏场景，核心游戏算法不得依赖 React 或 Canvas。
- 核心规则优先使用纯函数和可独立测试的模块。
- 修改核心机制必须补充测试，每个阶段结束时必须运行 test、typecheck、lint 和 build。
- 视觉必须由原创 Canvas、CSS 或项目自有 SVG 创建；除非批准了具有明确许可的原创资源，否则声音必须由 Web Audio API 合成。
- 产品 UI、README、代码注释、标识符和资源不得提及作为玩法参考来源的现有产品。
- AI 不得查看玩家未来输入或即将输入的文章内容。
- 生产静态路径必须兼容 `/typing/`，部署目标为 GitHub Pages。
- 本阶段不得实现游戏算法、AI 行为、文章内容、完整游戏 UI 或音频行为。

---

### 任务 1：长期文档与仓库卫生规则

**文件：**
- 修改：`.gitignore`
- 修改：`AGENTS.md`
- 创建：`docs/PRODUCT_SPEC.md`
- 创建：`README.md`

**接口：**
- 输入：将 `docs/superpowers/specs/2026-08-09-typing-gaming-design.md` 作为已确认的设计记录。
- 产出：`docs/PRODUCT_SPEC.md` 作为唯一产品需求来源，`AGENTS.md` 作为强制工程规则。

- [x] **步骤 1：扩展仓库忽略规则，同时保留提示词文件排除项**

保留 `prompt-gpt.md` 和 `prompt-my.md`，然后精确排除 `node_modules/`、`dist/`、`coverage/`、`.vite/`、`*.tsbuildinfo`、编辑器文件、操作系统文件、日志和本地环境文件，同时保留安全的 `!.env.example` 例外。

- [x] **步骤 2：编写强制执行的 `AGENTS.md` 规则**

沿用现有标题，补充产品目标、规划目录职责、用户要求的全部长期约束、保护用户改动的规则，以及固定检查顺序：`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`。明确 `docs/PRODUCT_SPEC.md` 是权威来源，设计和计划文档只记录决策历史。

- [x] **步骤 3：编写唯一产品规格**

创建 `docs/PRODUCT_SPEC.md`，明确覆盖产品范围、原创要求、开局设置、状态机、一维弧长道路模型、车辆距离与同时掉头、IME 输入、三秒滚动速度模型、四档 AI、英文和中文文章数量及长度、UI/Canvas/音频职责、测试、GitHub Pages、实施阶段和验收条件。复制已确认设计中的具体公式和优先级规则，不使用模糊摘要替代。

- [x] **步骤 4：记录第 1 阶段命令和范围**

创建 `README.md`，包含标题、初始化状态、Node.js 22.12+ 前置要求，以及 `npm install`、`npm run dev`、`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`npm run preview`。说明虽然 `build` 会重复执行 TypeScript 编译，`typecheck` 仍是独立门禁，并明确当前页面仅为占位页。

- [x] **步骤 5：检查文档中的受限引用和占位内容**

运行：

```bash
rg -n 'T[B]D|T[O]DO|F[I]XME|待[定]|未[决]定' AGENTS.md README.md docs/PRODUCT_SPEC.md
```

预期：没有匹配。根据全局约束人工复核这三个文件。

- [x] **步骤 6：提交文档基础**

```bash
git add .gitignore AGENTS.md README.md docs/PRODUCT_SPEC.md docs/superpowers/plans/2026-08-09-project-foundation.md
git commit -m "docs: establish project requirements and workflow"
```

### 任务 2：Vite、React、TypeScript、Vitest 和代码检查工具链

**文件：**
- 创建：`package.json`
- 创建：`package-lock.json`
- 创建：`index.html`
- 创建：`vite.config.ts`
- 创建：`vitest.config.ts`
- 创建：`tsconfig.json`
- 创建：`tsconfig.app.json`
- 创建：`tsconfig.node.json`
- 创建：`.oxlintrc.json`

**接口：**
- 输入：Node.js 22.12+ 和 npm。
- 产出：`dev`、`build`、`test`、`test:watch`、`typecheck`、`lint`、`preview` 命令，以及 Vite production base `/typing/`。

- [x] **步骤 1：创建具有精确脚本约定的 `package.json`**

使用以下 package 结构；依赖范围根据当前官方 Vite React TypeScript 模板和当前 Vitest 版本核对：

```json
{
  "name": "typing-gaming",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --pretty false",
    "lint": "oxlint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@types/node": "^24.13.2",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.3",
    "oxlint": "^1.71.0",
    "typescript": "~6.0.2",
    "vite": "^8.1.5",
    "vitest": "^4.1.10"
  }
}
```

- [x] **步骤 2：创建严格的 TypeScript 项目引用**

`tsconfig.json` 引用 `tsconfig.app.json` 和 `tsconfig.node.json`。应用配置目标为 ES2023，包含 DOM 和 `vite/client`，使用 bundler resolution、`react-jsx`、`noEmit`、未使用项检查和 `erasableSyntaxOnly`。Node 配置目标为 ES2023，使用 NodeNext，包含 Node 类型，并检查 `vite.config.ts` 和 `vitest.config.ts`。

- [x] **步骤 3：配置 Vite 和 Vitest**

`vite.config.ts` 必须导出 `defineConfig({ base: '/typing/', plugins: [react()] })`。`vitest.config.ts` 必须使用 React 插件、Node 环境和 `src/**/*.test.{ts,tsx}` 包含规则，不启用全局测试 API。

- [x] **步骤 4：配置代码检查和 HTML 入口**

使用官方模板提供的 Oxlint React/TypeScript 插件和 hooks 规则。`index.html` 不包含下载的 favicon，使用 `<title>Typing Gaming</title>`，提供 `#root`，并通过 Vite 加载 `/src/main.tsx`。

- [x] **步骤 5：安装依赖并锁定依赖图**

运行：

```bash
npm install
```

预期：生成 `package-lock.json`，npm 成功退出。

- [x] **步骤 6：在实现 UI 前确认配置已被识别**

运行：

```bash
npm run typecheck
```

预期：因为 `src/main.tsx` 尚不存在而失败。这是结构前置检查，不是功能 RED 测试。

- [x] **步骤 7：提交工具链**

```bash
git add package.json package-lock.json index.html vite.config.ts vitest.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json .oxlintrc.json
git commit -m "build: configure frontend toolchain"
```

### 任务 3：通过 TDD 创建最小初始化页面

**文件：**
- 创建：`src/app/App.test.tsx`
- 创建：`src/app/App.tsx`
- 创建：`src/main.tsx`
- 创建：`src/styles/global.css`

**接口：**
- 输入：任务 2 创建的 React 和 Vitest 工具链。
- 产出：默认 React 组件 `App` 和浏览器入口 `src/main.tsx`。

- [x] **步骤 1：编写失败的页面行为测试**

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('shows the project initialization message', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('<h1>Typing Gaming</h1>')
    expect(markup).toContain('<p>Project initialized successfully.</p>')
  })
})
```

- [x] **步骤 2：运行测试并确认 RED**

运行：

```bash
npm test -- src/app/App.test.tsx
```

预期：因为 `./App` 不存在而失败，失败信息必须指出缺少页面实现。

- [x] **步骤 3：只实现占位组件**

```tsx
function App() {
  return (
    <main className="app-shell">
      <section className="status-card" aria-labelledby="project-title">
        <h1 id="project-title">Typing Gaming</h1>
        <p>Project initialized successfully.</p>
      </section>
    </main>
  )
}

export default App
```

- [x] **步骤 4：添加浏览器入口和最小 CSS**

`src/main.tsx` 在 `StrictMode` 中渲染 `App`，并导入 `src/styles/global.css`。CSS 只提供中性、响应式、居中的卡片，使用系统字体、清晰对比度和 `box-sizing`；不得加入游戏控件、车辆、HUD 或第三方素材。

- [x] **步骤 5：运行测试并确认 GREEN**

运行：

```bash
npm test -- src/app/App.test.tsx
```

预期：一个测试通过，且没有警告。

- [x] **步骤 6：提交经过测试的占位页**

```bash
git add src/app/App.test.tsx src/app/App.tsx src/main.tsx src/styles/global.css
git commit -m "feat: add initialized project page"
```

### 任务 4：预留与框架无关的模块边界

**文件：**
- 创建：`src/components/index.ts`
- 创建：`src/game/types.ts`
- 创建：`src/game/track.ts`
- 创建：`src/game/vehicle.ts`
- 创建：`src/game/engine.ts`
- 创建：`src/game/ai.ts`
- 创建：`src/game/speedModel.ts`
- 创建：`src/input/index.ts`
- 创建：`src/articles/index.ts`
- 创建：`src/audio/index.ts`
- 创建：`src/utils/index.ts`

**接口：**
- 输入：仅 TypeScript；不使用 React、DOM、Canvas、文章数据、音频行为或 AI 行为。
- 产出：为后续阶段提供稳定的文件系统边界，不导出未经设计的运行时 API。

- [x] **步骤 1：创建不含功能行为的边界模块**

每个文件包含简短的职责说明和 `export {}`，使其成为独立 TypeScript 模块。`types.ts` 说明共享引擎类型放置于此；其他游戏模块分别预留道路几何、车辆状态、模拟编排、AI 控制和玩家速度模型。本阶段明确要求这些结构骨架文件，它们不属于生产功能行为。

- [x] **步骤 2：确认骨架可以编译并通过代码检查**

运行：

```bash
npm run typecheck
npm run lint
```

预期：两个命令均成功退出且没有错误。

- [x] **步骤 3：提交架构边界**

```bash
git add src/components src/game src/input src/articles src/audio src/utils
git commit -m "chore: reserve application module boundaries"
```

### 任务 5：完整阶段验证与范围审计

**文件：**
- 验证：任务 1 至任务 4 创建或修改的全部文件。

**接口：**
- 输入：第 1 阶段的全部交付物。
- 产出：证明全部质量门禁通过且未加入范围外功能的最新证据。

- [x] **步骤 1：运行完整测试套件**

```bash
npm test
```

预期：包括占位页测试在内的全部测试通过。

- [x] **步骤 2：运行独立 TypeScript 检查**

```bash
npm run typecheck
```

预期：退出码为 0，且没有 TypeScript 错误。

- [x] **步骤 3：运行代码检查**

```bash
npm run lint
```

预期：退出码为 0，且没有代码检查错误。

- [x] **步骤 4：运行生产构建**

```bash
npm run build
```

预期：退出码为 0，生成 `dist/` 构建，且生成的资源引用位于 `/typing/` 下。

- [x] **步骤 5：检查构建入口和仓库范围**

运行：

```bash
rg -n '/typing/' dist/index.html
git status --short
git diff --check
```

预期：构建 HTML 包含 `/typing/`；`node_modules/`、`dist/` 和提示词文件未被暂存；不存在空白错误；没有实现 AI、文章库、游戏控件或完整 UI。

- [x] **步骤 6：提交验证阶段的修正**

只有验证过程确实产生修正时，才暂存对应文件并提交：

```bash
git commit -m "chore: complete project foundation"
```
