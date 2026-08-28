# Cavin

A spatial canvas for **progressive data editing**: browse a machine-organized dataset as a zoomable map of clusters and rooms-within-rooms, then refine it by direct manipulation — drag to move, drop onto a node to re-parent, lock to confirm. Zoom *is* the granularity axis; locking *is* the human-confirmation signal.

Cavin is a **generic, data-pluggable framework**: a headless, schema-agnostic core plus an embeddable React canvas. Hosts plug in any dataset by writing one `SchemaAdapter`. See [`docs/architecture-generic-framework.md`](docs/architecture-generic-framework.md) for the full design.

## Repository layout (npm workspaces)

```
packages/
├── core/            → @cavin/core — headless engine: CavinNode model, SchemaAdapter
│                      plug point, applyCommand command layer, deriveWorld, LOD engine,
│                      LayoutConfig, storage interface, adapter conformance suite
└── react/           → @cavin/react — <CavinCanvas/>, board renderers (rAF canvas +
                       imperative label layer + minimap), UI panels, store factories,
                       localStorage persistence
examples/
├── knowledge-palace/  the reference demo: an AI-clustered knowledge base
│                      (seeded generator + KnowledgeAdapter + thin App)
├── sanguo/            三国 curated dataset: 288 people, camps→roles grouping,
│                      confirmed relation edges, peak-year time axis
├── flat-tasks/        the genericity harness: 20-line adapter, zero grouping levels
└── machine-learning/  the palace's seeded data generator (consumed by knowledge-palace)
docs/
├── architecture-generic-framework.md  framework design + 5-phase roadmap
└── prd-spatial-refinement.md          product spec for the demo
```

Dependency direction is one-way: `examples/* → @cavin/react → @cavin/core`. The core imports nothing from React or the DOM; the React package never special-cases a schema.

## Quick start

```bash
npm install
npm run dev            # knowledge-palace at http://localhost:5173
npm run dev:sanguo     # the 三国 example
npm run dev:tasks      # flat task list (no grouping levels)
npm test               # vitest: framework contracts + example data invariants
npm run typecheck      # tsc -b (packages emit dist/ ESM+d.ts) + per-example tsc
npm run build          # packages + knowledge-palace production bundle
```

State persists to localStorage (`cavin:knowledge-palace:v4`; the pre-framework
`cavin-world-v3` flat payload is migrated transparently). Use the **reset demo**
button (top-right HUD) to wipe and regenerate the seeded palace. The camera
mirrors into the URL (`?x=&y=&zoom=`) for shareable views.

## Interactions

| Action | How |
|---|---|
| Pan / zoom | drag empty space / wheel (zoom-to-cursor) |
| Open a node's children as a room | zoom toward it — children spread onto a ring |
| Select / details | click a label |
| Edit | double-click a label, or ✎ in the panel |
| New node | double-click empty space, `N`, or ＋ new |
| New child | `C` with a selection, or ＋ Child in the panel |
| Move (with subtree) | drag the label |
| Re-parent | drag a label onto another node |
| Promote to root | drag a child onto empty space |
| Lock = human-confirm | `L` or 🔓 — blocks edits/moves/deletes and shields the subtree |
| Delete (cascade, lock-shielded) | `Del` or 🗑 in the panel |
| Search & fly-to | `/` or the search box |
| Confirm a connection | click ⤳ suggestion in the panel |

## Framework direction — roadmap complete

The migration roadmap (architecture doc, §7) has five phases; all shipped:

- **P1 done** — all tuning constants in one `LayoutConfig`; view/world stores decoupled.
- **P2 done** — `CavinNode`/`SchemaAdapter` types; `deriveWorld` aggregates generic `world.groups` over `groupPath` (any depth); UI reads fields only through adapter accessors.
- **P3 done** — `@cavin/core` extracted (`packages/core`): DOM-free, React-free (`lib: ["ES2022"]` only). `CavinNode` is the real node shape (attributes payload + framework state), colors moved behind `adapter.colorOf`, and the store's actions became `applyCommand` calls — the single, serializable mutation funnel.
- **P4 done** — `@cavin/react` extracted (`packages/react`): store factories + `<CavinCanvas/>` with the adapter injected; per-instance state, so two canvases coexist on one page. `examples/flat-tasks` mounts the same component against a 20-line adapter.
- **P5 done** — the palace lives at `examples/knowledge-palace`; `examples/sanguo` is a second full example (its legacy preview shim is gone); both packages build ESM+d.ts; the adapter conformance suite (`@cavin/core/testing`) runs against both host adapters.

## Status

Single-user, local-first prototype. No backend, no undo, no multi-select — deliberately out of scope (see the PRD). Tested at ~1k nodes; 5k–50k stress validation is planned against `examples/knowledge-palace`.
