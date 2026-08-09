# Typing Gaming Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reliable Vite, React, TypeScript, Vitest, CSS, and linting foundation with project-wide constraints, a canonical product specification, testable module boundaries, and a minimal initialization page.

**Architecture:** React owns the current placeholder UI and future menus/HUD, while `src/game` is reserved for framework-independent TypeScript logic and Canvas rendering will be added in a later phase. Vitest runs behavior tests in Node, TypeScript project references provide separate app/tooling checks, and Vite builds all production URLs under `/typing/`.

**Tech Stack:** Node.js 22.12+, npm, Vite 8, React 19, TypeScript 6, Vitest 4, Oxlint, CSS.

## Global Constraints

- The product name is Typing Gaming.
- The product is single-player and has no networking, accounts, ranking, or server dependencies.
- React owns UI; Canvas will own the game scene; core game algorithms must not depend on either React or Canvas.
- Core rules must favor pure functions and independently testable modules.
- Core-mechanic changes require tests, and each phase ends with test, typecheck, lint, and build.
- Visuals must be original Canvas, CSS, or project-owned SVG; sound must be synthesized with Web Audio API unless a clearly licensed original resource is approved.
- Product UI, README, code comments, identifiers, and assets must not mention existing products used as gameplay references.
- AI must never inspect future player input or upcoming article content.
- Production static paths must work under `/typing/` and deployment targets GitHub Pages.
- This phase must not implement game algorithms, AI behavior, article content, a full game UI, or audio behavior.

---

### Task 1: Long-term documentation and repository hygiene

**Files:**
- Modify: `.gitignore`
- Modify: `AGENTS.md`
- Create: `docs/PRODUCT_SPEC.md`
- Create: `README.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-09-typing-gaming-design.md` as the accepted design record.
- Produces: `docs/PRODUCT_SPEC.md` as the sole canonical product requirements source and `AGENTS.md` as mandatory engineering policy.

- [x] **Step 1: Expand repository ignore rules without removing prompt-file exclusions**

Keep `prompt-gpt.md` and `prompt-my.md`, then add exact exclusions for `node_modules/`, `dist/`, `coverage/`, `.vite/`, `*.tsbuildinfo`, editor files, OS files, logs, and local environment files while retaining a safe `!.env.example` exception.

- [x] **Step 2: Write the mandatory `AGENTS.md` policy**

Use the existing headings and fill them with the product goal, the planned directory ownership, every long-term constraint from the user request, rules for preserving user changes, and the required order `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. State that `docs/PRODUCT_SPEC.md` is authoritative and that design/plan documents are decision history only.

- [x] **Step 3: Write the canonical product specification**

Create `docs/PRODUCT_SPEC.md` with explicit sections for scope, originality, pre-game settings, state machine, one-dimensional arc-length track model, vehicle distance and simultaneous reversal, IME input, rolling three-second speed model, all four AI profiles, English/Chinese article counts and lengths, UI/Canvas/audio ownership, testing, GitHub Pages, implementation phases, and acceptance criteria. Copy concrete formulas and priority rules from the accepted design rather than replacing them with summaries.

- [x] **Step 4: Document the phase-one commands and boundaries**

Create `README.md` with the title, the initialization status, Node.js 22.12+ prerequisite, `npm install`, `npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run preview`. Explain that `typecheck` is a standalone gate even though `build` repeats TypeScript compilation, and state that the current page is intentionally only a placeholder.

- [x] **Step 5: Inspect documentation for forbidden references and placeholders**

Run:

```bash
rg -n 'T[B]D|T[O]DO|F[I]XME|待[定]|未[决]定' AGENTS.md README.md docs/PRODUCT_SPEC.md
```

Expected: no matches. Review the three files manually against the global constraints.

- [x] **Step 6: Commit the documentation foundation**

```bash
git add .gitignore AGENTS.md README.md docs/PRODUCT_SPEC.md docs/superpowers/plans/2026-08-09-project-foundation.md
git commit -m "docs: establish project requirements and workflow"
```

### Task 2: Vite, React, TypeScript, Vitest, and lint toolchain

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `.oxlintrc.json`

**Interfaces:**
- Consumes: Node.js 22.12+ and npm.
- Produces: commands `dev`, `build`, `test`, `test:watch`, `typecheck`, `lint`, and `preview`; Vite production base `/typing/`.

- [ ] **Step 1: Create `package.json` with exact script contracts**

Use this package shape, with dependency ranges verified from the current official Vite React TypeScript template and current Vitest release:

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

- [ ] **Step 2: Create strict TypeScript project references**

`tsconfig.json` references `tsconfig.app.json` and `tsconfig.node.json`. The app config targets ES2023, includes DOM and `vite/client`, uses bundler resolution, `react-jsx`, `noEmit`, unused checks, and `erasableSyntaxOnly`. The node config targets ES2023, uses NodeNext, includes Node types, and checks both `vite.config.ts` and `vitest.config.ts`.

- [ ] **Step 3: Configure Vite and Vitest**

`vite.config.ts` must export `defineConfig({ base: '/typing/', plugins: [react()] })`. `vitest.config.ts` must use the React plugin, Node environment, `src/**/*.test.{ts,tsx}` inclusion, and no global test APIs.

- [ ] **Step 4: Configure lint and the HTML entry**

Use the official template's Oxlint React/TypeScript plugins and hook rules. `index.html` contains no downloaded favicon, uses `<title>Typing Gaming</title>`, provides `#root`, and loads `/src/main.tsx` through Vite.

- [ ] **Step 5: Install dependencies and lock the graph**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits successfully.

- [ ] **Step 6: Verify the configuration is accepted before UI implementation**

Run:

```bash
npm run typecheck
```

Expected: failure because `src/main.tsx` does not exist yet. This is a structural precondition, not the feature RED test.

- [ ] **Step 7: Commit the toolchain**

```bash
git add package.json package-lock.json index.html vite.config.ts vitest.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json .oxlintrc.json
git commit -m "build: configure frontend toolchain"
```

### Task 3: Minimal initialized page through TDD

**Files:**
- Create: `src/app/App.test.tsx`
- Create: `src/app/App.tsx`
- Create: `src/main.tsx`
- Create: `src/styles/global.css`

**Interfaces:**
- Consumes: React and Vitest toolchain from Task 2.
- Produces: default React component `App` and browser entry `src/main.tsx`.

- [ ] **Step 1: Write the failing page behavior test**

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

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: FAIL because `./App` does not exist. The failure must identify the missing page implementation.

- [ ] **Step 3: Implement only the placeholder component**

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

- [ ] **Step 4: Add the browser entry and minimal CSS**

`src/main.tsx` renders `App` inside `StrictMode` and imports `src/styles/global.css`. CSS provides only a neutral responsive centered card, system fonts, readable contrast, and `box-sizing`; it must not introduce game controls, vehicles, HUD, or third-party assets.

- [ ] **Step 5: Run the test and verify GREEN**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: one test passes with no warnings.

- [ ] **Step 6: Commit the tested placeholder page**

```bash
git add src/app/App.test.tsx src/app/App.tsx src/main.tsx src/styles/global.css
git commit -m "feat: add initialized project page"
```

### Task 4: Reserve framework-independent module boundaries

**Files:**
- Create: `src/components/index.ts`
- Create: `src/game/types.ts`
- Create: `src/game/track.ts`
- Create: `src/game/vehicle.ts`
- Create: `src/game/engine.ts`
- Create: `src/game/ai.ts`
- Create: `src/game/speedModel.ts`
- Create: `src/input/index.ts`
- Create: `src/articles/index.ts`
- Create: `src/audio/index.ts`
- Create: `src/utils/index.ts`

**Interfaces:**
- Consumes: only TypeScript; no React, DOM, Canvas, article data, audio behavior, or AI behavior.
- Produces: stable filesystem boundaries for later phases without exporting invented runtime APIs.

- [ ] **Step 1: Create boundary modules without feature behavior**

Each file contains a concise responsibility comment and `export {}` so it is an isolated TypeScript module. `types.ts` states that shared engine types will live there; the other game modules respectively reserve track geometry, vehicle state, simulation orchestration, AI control, and player speed modeling. These are structural skeleton files explicitly requested for this phase, not production behavior.

- [ ] **Step 2: Verify the skeleton compiles and lints**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both commands exit successfully with no errors.

- [ ] **Step 3: Commit the architecture boundaries**

```bash
git add src/components src/game src/input src/articles src/audio src/utils
git commit -m "chore: reserve application module boundaries"
```

### Task 5: Full phase verification and scope audit

**Files:**
- Verify: all files created or modified in Tasks 1–4.

**Interfaces:**
- Consumes: all phase-one deliverables.
- Produces: fresh evidence that every required quality gate passes and no out-of-scope feature was added.

- [ ] **Step 1: Run the complete test suite**

```bash
npm test
```

Expected: all tests pass, including the placeholder page test.

- [ ] **Step 2: Run standalone TypeScript checking**

```bash
npm run typecheck
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: exit code 0 with no lint errors.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: exit code 0, a `dist/` build, and generated asset references under `/typing/`.

- [ ] **Step 5: Inspect the built entry and repository scope**

Run:

```bash
rg -n '/typing/' dist/index.html
git status --short
git diff --check
```

Expected: the built HTML contains `/typing/`; `node_modules/`, `dist/`, and prompt files are not staged; no whitespace errors exist; no AI, article corpus, game controls, or complete UI has been implemented.

- [ ] **Step 6: Commit any verification-only corrections**

Only if verification required changes, stage the exact corrected files and commit:

```bash
git commit -m "chore: complete project foundation"
```
