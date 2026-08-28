# AGENTS.md — guidance for coding agents

## What this project is

Cavin is a generic **progressive data editing** framework: a headless core (`@cavin/core`) plus an optional React canvas (`@cavin/react`), with three example consumers — the knowledge-palace demo (the reference consumer), the 三国 sanguo dataset, and the flat-tasks genericity harness. The authoritative design doc is `docs/architecture-generic-framework.md` — read it before touching `packages/core`. The product spec for the demo is `docs/prd-spatial-refinement.md`. The P1–P5 migration roadmap (doc §7) is complete; the doc's target layout is now the actual layout.

## Commands

- `npm run dev` / `dev:sanguo` / `dev:tasks` — Vite dev server per example
- `npm test` — Vitest (pure-layer contract tests + example data tests; must stay green)
- `npm run typecheck` — `tsc -b` packages (emits `dist/` ESM+d.ts) + per-example `tsc`
- `npm run build` — packages + knowledge-palace production bundle

There is no linter or formatter configured — match surrounding style and let `tsc` be the gate.

## Hard rules

1. **Do not break existing behavior.** After any change: `npm test` AND `npm run typecheck` must pass, and if you touched interaction or store logic, smoke-test create → edit → delete in the running app.
2. **All tuning constants live in `packages/core/src/config.ts`** (`layoutConfig`). Never introduce a bare numeric layout/LOD/interaction literal elsewhere. (Canvas paint alphas in DotsCanvas/Minimap are visual styling and intentionally inline.)
3. **The core stays pure.** `packages/core/**` must remain DOM-free, React-free, and store-free — it typechecks against `lib: ["ES2022"]` only. That's why the localStorage storage implementation lives in `@cavin/react`, not core.
4. **Per-instance state.** Stores are factories created in `CavinCanvas`; never reintroduce module-level store singletons. The world store never imports the view store — the selection bridge lives in `CavinCanvas.tsx`.
5. **Schema fields belong to the adapter.** Nodes are `CavinNode<TAttr>`: content lives in `attributes`, structure in `id`/`parentId`/`position`/`groupPath`/`state`. UI/board code reads content only through `@cavin/core`'s accessors (`labelOf`/`tagsOf`/`bodyOf`/`timeOf`) or the adapter itself, and colors only through `adapter.colorOf` / `nodeColorIndex` — never schema fields by name. Node/group colors are presentation, derived at render time (`packages/react/src/presentation.ts`); never write a `color`/`hue` field onto a node.
6. **All edits go through `applyCommand`.** The world store's actions are thin dispatchers; put mutation semantics (locks, cycles, orbit re-join) in `packages/core/src/commands.ts`, not in the store. Toast copy maps from `MutationResult` notice/error kinds in `packages/react/src/world-store.ts` — the core never prints strings.

## Structure notes

- Package resolution is source-first: each package's `exports` maps to `./src/index.ts`, so dev servers and Vitest consume TypeScript with no build step. `npm run build` emits `dist/` (ESM + d.ts) as the publishability proof; nothing is published to npm.
- `deriveWorld(nodes, adapter, prev?, confirmedEdges?, config?)` is the single derive: it aggregates `world.groups` from `groupPath` (arbitrary depth), builds tree indexes, re-anchors unplaced children, and merges suggested+confirmed edges. There are no rooms/wings anywhere — renderers slice `world.groups` by `depth`.
- `reparentNodes` moves a subtree's `groupPath` to the new parent; the adapter's `groupOf` is the fallback for nodes that arrive without a path (fresh imports).
- Persistence: `cavin:knowledge-palace:v4` holds `CavinNode` records; the legacy flat `cavin-world-v3` payload is decoded by `knowledgeAdapter.validate` on load (see `examples/knowledge-palace/src/adapter.ts`) and never written again.
- The time axis is adapter-declared: flag one numeric `FieldDescriptor` with `time: true`; the range derives from data (`timeRangeOf`), never module-load time.

## Testing expectations

- `packages/core/src/*.test.ts` — the framework contract tests: deriveWorld invariants, generic grouping (0/1/2/3 levels), mutation rules, command invariants, edge merge rules. Extend these when changing pure functions.
- `@cavin/core/testing` exports `runAdapterConformance` — every host adapter (knowledge, sanguo) runs it from its example's test file. New adapters must too.
- Example tests (`examples/*/src/*.test.ts`) cover dataset-specific invariants (seed labels, group counts, migration).
- UI/store paths are not covered by tests. A green suite is necessary, not sufficient; verify store-level changes in the browser.

## Git

- Remote: `origin` → github.com/todjiang/Cavin, branch `main`.
- Commit messages: concise subject + bullet body explaining *why*, especially for behavior-preserving refactors.
