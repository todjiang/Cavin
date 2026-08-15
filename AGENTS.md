# AGENTS.md — guidance for coding agents

## What this project is

Cavin is becoming a generic **progressive data editing** framework (headless core + optional React canvas) with a knowledge-palace demo as its reference consumer. The authoritative design doc is `docs/architecture-generic-framework.md` — read it before touching `src/core`, `src/data`, or `src/demo`. The product spec for the demo is `docs/prd-spatial-refinement.md`.

## Commands

- `npm run dev` — Vite dev server
- `npm test` — Vitest (pure data-layer tests; must stay green)
- `npm run build` — `tsc -b && vite build` (typecheck + bundle; must stay green)

There is no linter or formatter configured — match surrounding style and let `tsc` be the gate.

## Hard rules

1. **Do not break existing behavior.** Every refactor so far has kept the demo pixel-identical and the test suite green. After any change: `npm test` AND `npx tsc -b` must pass, and if you touched interaction or store logic, smoke-test create → edit → delete in the running app.
2. **All tuning constants live in `src/config.ts`** (`layoutConfig`). Never introduce a bare numeric layout/LOD/interaction literal elsewhere.
3. **The pure data layer stays pure.** `src/data/layout.ts` and `src/board/lod.ts` must remain DOM-free, React-free, and store-free — they are the future `@cavin/core`.
4. **Store decoupling:** `src/store/world.ts` must never import `src/store.ts`. Cross-store effects go through `requestedSelection` + the bridge subscription in `src/App.tsx`.
5. **Schema fields belong to the adapter.** New code must not read `title`/`body`/`tags`/`wingId`/`roomId` directly outside `src/demo/` and the legacy UI files that already do. Prefer `knowledgeAdapter.labelOf` / `groupOf` / `fields` in anything new.

## Migration context (read before refactoring)

We are mid-roadmap (doc §7). P1 done, P2 partial, P3–P5 pending. Known transitional artifacts — do not "fix" them without understanding why they exist:

- `LaidOutNode` still extends the legacy flat `KnowledgeNode` shape so the UI compiles unchanged; `CavinNode<TAttr>` (`src/core/schema.ts`) is the target model.
- `groupPath` on nodes is **write-only** (computed in `deriveWorld`, consumed by nothing yet) — a forward seam for P2-full, not dead code to delete.
- `knowledgeAdapter.createDefault` returns *provisional* wing/room ids derived from display names; `src/store/world.ts` overrides them with authoritative cluster ids. Never trust the adapter's ids for clustering.
- `validate` in the adapter decodes the legacy flat persisted shape; persistence itself still writes that shape (`src/data/persist.ts`).
- Colors/hues come from index-based `wingHue` in `layout.ts`, not from `adapter.colorOf` — that hook is reserved.

## Testing expectations

- Existing suite: `src/data/layout.test.ts` covers `deriveWorld` invariants and tree mutations. Extend it when changing pure functions.
- Tests cover the pure layer only — the store and UI paths are NOT covered. A green suite is necessary, not sufficient; verify store-level changes in the browser.
- The architecture doc (§8) plans an adapter conformance suite (`@cavin/core/testing`) — write new adapters against `SchemaAdapter` in `src/core/schema.ts` so they can adopt it later.

## Git

- Remote: `origin` → github.com/todjiang/Cavin, branch `main`.
- Commit messages: concise subject + bullet body explaining *why*, especially for behavior-preserving refactors.
