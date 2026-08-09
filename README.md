# Typing Gaming

Typing Gaming is a single-player browser typing chase game. The repository is currently in its foundation phase: the toolchain, architectural boundaries, product requirements, and quality gates are being established before gameplay implementation begins.

The current page intentionally displays only:

> Project initialized successfully.

## Requirements

- Node.js 22.12 or newer
- npm

## Setup

```bash
npm install
```

## Commands

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

- `npm run dev` starts the Vite development server.
- `npm test` runs the Vitest suite once.
- `npm run typecheck` runs the standalone TypeScript project check.
- `npm run lint` runs Oxlint across the repository.
- `npm run build` repeats TypeScript compilation and creates the production Vite bundle.
- `npm run preview` serves the production bundle locally.

`typecheck` remains a separate required gate even though `build` also compiles TypeScript. Every development round must pass test, typecheck, lint, and build before completion.

## Architecture

- React owns application UI.
- Canvas will own the game scene.
- Framework-independent TypeScript modules under `src/game/` will own game rules.
- `docs/PRODUCT_SPEC.md` is the sole canonical product requirements source.

Production assets are built for the GitHub Pages base path `/typing/`.
