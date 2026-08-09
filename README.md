# Typing Gaming

Typing Gaming 是一款单人网页打字追逐游戏。仓库目前处于工程基础阶段：在开始实现游戏玩法前，先建立工具链、架构边界、产品需求和质量门禁。

当前页面按计划只显示：

> Project initialized successfully.

## 环境要求

- Node.js 22.12 或更高版本
- npm

## 安装

```bash
npm install
```

## 常用命令

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

- `npm run dev`：启动 Vite 开发服务器。
- `npm test`：运行一次 Vitest 测试套件。
- `npm run typecheck`：独立执行 TypeScript 项目检查。
- `npm run lint`：使用 Oxlint 检查整个仓库。
- `npm run build`：重新执行 TypeScript 编译并生成 Vite 生产构建。
- `npm run preview`：在本地预览生产构建。

虽然 `build` 也会编译 TypeScript，`typecheck` 仍是独立且必须通过的质量门禁。每轮开发结束前都必须通过 test、typecheck、lint 和 build。

## 架构

- React 负责应用 UI。
- Canvas 负责后续游戏场景。
- `src/game/` 下与框架无关的 TypeScript 模块负责游戏规则。
- `docs/PRODUCT_SPEC.md` 是唯一有效的产品需求来源。

生产资源按 GitHub Pages 基础路径 `/typing/` 构建。
