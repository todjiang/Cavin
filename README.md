# Cavin

A spatial canvas for **progressive data editing**: browse a machine-organized dataset as a zoomable map of clusters and rooms-within-rooms, then refine it by direct manipulation — drag to move, drop onto a node to re-parent, lock to confirm. Zoom *is* the granularity axis; locking *is* the human-confirmation signal.

Cavin is being refactored from a single-purpose demo (an AI-clustered knowledge base, the "memory palace") into a **generic, data-pluggable framework**: a headless, schema-agnostic core plus an optional embeddable React canvas. Hosts plug in any dataset by writing one `SchemaAdapter`. See [`docs/architecture-generic-framework.md`](docs/architecture-generic-framework.md) for the full design and migration roadmap.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: pure data-layer invariants
npm run build      # tsc -b && vite build
```

State persists to localStorage. Use the **reset demo** button (top-right HUD) to wipe and regenerate the seeded palace. Camera position is mirrored in the URL (`?x=&y=&zoom=`) for shareable views.

## Interactions

| Action | How |
|---|---|
| Pan / zoom | drag empty space / wheel (zoom-to-cursor) |
| Open a note's children as a room | zoom toward it — children spread onto a ring |
| Select / details | click a label |
| Edit | double-click a label, or ✎ in the panel |
| New note | double-click empty space, `N`, or ＋ new note |
| New child | `C` with a selection, or ＋ Child in the panel |
| Move (with subtree) | drag the label |
| Re-parent | drag a label onto another node |
| Promote to root | drag a child onto empty space |
| Lock = human-confirm | `L` or 🔓 — blocks edits/moves/deletes and shields the subtree |
| Delete (cascade, lock-shielded) | `Del` or 🗑 in the panel |
| Search & fly-to | `/` or the search box |

## Repository layout

```
src/
├── config.ts        LayoutConfig — ALL layout/LOD/interaction constants live here
├── store.ts         view store: camera, LOD thresholds, selection, URL sync
├── store/world.ts   world store: editing actions → deriveWorld → persist
├── core/
│   └── schema.ts    CavinNode<TAttr>, SchemaAdapter — the framework plug point
├── data/
│   ├── layout.ts    pure data layer: deriveWorld, layoutNodes, reparent/promote
│   ├── persist.ts   WorldStorage interface + localStorage impl (fail-safe)
│   └── layout.test.ts
├── demo/            the knowledge-palace example dataset
│   ├── generate.ts  seeded mock palace (deterministic mulberry32)
│   └── adapter.ts   knowledgeAdapter — reference SchemaAdapter implementation
├── board/           canvas + imperative label layers, LOD/room-morph engine
└── ui/              HUD, detail panel, search, minimap, toasts
docs/
├── architecture-generic-framework.md  framework design + 5-phase roadmap
└── prd-spatial-refinement.md          product spec for the demo
```

## Framework direction (where this is going)

The migration roadmap (in the architecture doc, §7) has five phases:

- **P1 done** — constants collected into `LayoutConfig`; world/view stores decoupled (selection bridge in `App.tsx`).
- **P2 done** — `CavinNode`/`SchemaAdapter` types and the demo adapter exist; `deriveWorld` aggregates generic `world.groups` over `groupPath` (any depth) and all renderers read them; every UI field access goes through `labelOf`/`fields`/`searchTextOf` accessors (`src/core/accessors.ts`); node creation and edits go through the adapter (`createDefault`, descriptor-driven detail panel). Headless proof: `src/data/groups.test.ts` runs the same derive over 0/2/3-level groupings.
- **P3–P5 pending** — extract `@cavin/core` (DOM-free engine, `CavinNode` becomes the real node shape, colors move behind `adapter.colorOf`) and `@cavin/react` (`<CavinCanvas/>` with the adapter injected), move the palace to `examples/knowledge-palace`.

## Status

Single-user, local-first prototype. No backend, no undo, no multi-select — deliberately out of scope (see the PRD). Tested at ~1k nodes; 5k–50k stress validation is planned.
