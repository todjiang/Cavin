# Cavin as a Generic Framework for Progressive Data Editing

**Status:** Landed — the §7 roadmap (P1–P5) is implemented; the §3 target layout below is the actual repository layout (npm workspaces rather than pnpm). This document remains the design reference.
**Date:** 2026-08-15
**Supersedes relationship:** Builds on the shipped prototype specified in `docs/prd-spatial-refinement.md`. That PRD remains the product spec for the knowledge-palace demo; this document specifies how the prototype's machinery becomes a reusable, data-pluggable framework.

---

## 1. Vision

Cavin today is a single-purpose app: a spatial map of an AI-clustered knowledge base that a human progressively refines. The interaction model it implements is not specific to knowledge notes. Any dataset that (a) arrives as a machine-produced draft and (b) needs a human to see, navigate, and correct its organization has the same shape: a tree of items, grouped into clusters, edited by direct manipulation, with human-confirmed structure protected from future machine writes.

**Progressive data editing** names this model along two axes:

- **Progressive presentation** — the dataset reveals itself by zoom. Clusters resolve into items; items with children open as rooms; deeper levels reveal as rooms-within-rooms. Zoom *is* the granularity axis, so a large tree is never dumped on screen at once.
- **Progressive governance** — data moves through a lifecycle: machine draft → human refinement (move, re-parent, edit, delete) → human-confirmed (`locked`/`confirmed`). Confirmed structure is thereafter read-only to both accidents and future machine imports.

**Goal of the framework:** any project can embed this model by writing one **data adapter**. The framework ships a schema-agnostic headless core (data model, mutations, layout, LOD) and an optional React UI (the zoomable canvas and its panels). Nothing in the core knows what a "note", "wing", or "room" is.

### Design goals

1. **Pluggable data** — the host defines the item schema, grouping levels, labels, colors, and validation through one `SchemaAdapter` object. The demo's `KnowledgeNode` becomes one adapter among many.
2. **Embeddable anywhere** — the core is framework-free TypeScript (no DOM, no React). The React package is a self-contained `<CavinCanvas/>` component with its own per-instance state; two canvases can coexist on one page.
3. **Headless-usable** — tests, importers, and non-React hosts can drive the full editing semantics without mounting any UI.
4. **Behavioral continuity** — the refactor preserves the shipped demo's behavior and invariants exactly; the knowledge palace becomes the framework's reference example.

### Non-goals (unchanged from the PRD, plus one)

- No backend, accounts, or real-time multi-user collaboration. The storage interface is the reserved seam.
- No undo/redo, multi-select, or mobile/pinch input. The command layer (§4.4) is designed so undo can be added later without reworking call sites.
- **New:** no attempt to make the *visual* theme fully generic in v1 (chip/card styling ships as overridable defaults, not a theming system).

---

## 2. Current State Assessment

The prototype (~3,850 LOC, React 19 + Zustand + Vite) already contains clean extraction seams. This section maps what exists today, because the framework design is organized around reusing these seams rather than rewriting them.

### 2.1 Seams that already exist

| Seam | Location | Why it matters |
|---|---|---|
| Pure data layer | `src/data/layout.ts` | `deriveWorld`, `reparentNodes`, `promoteToRootNodes`, `deletableSubtree`, `movableSubtree` are DOM-free, store-free pure functions over a node array, returning a typed `TreeMutationOutcome`. Already unit-tested (`src/data/layout.test.ts`). |
| Storage interface | `src/data/persist.ts` | `WorldStorage` (`load`/`save`/`clear`/`subscribe?`) with a localStorage implementation and a `setWorldStorage()` swap point. Only the node array crosses the boundary; all aggregates are re-derived on load. Fail-safe by contract. |
| Single mutation funnel | `src/store/world.ts` (`mutate`) | Every structural edit flows through one helper: `nodes → fn → deriveWorld → set → debounced persist`. A command/undo layer can be inserted at exactly one point. |
| LOD engine | `src/board/lod.ts` | `roomMorph`, `visibleNodes`, `revealZoom`, `zoomGate`, `focusFalloff` are pure functions of `(world, camera, zoom, thresholds)`. Nearly schema-agnostic already — they read only `id`, `parentId`, `position`, `placed`, `relOffset`. |
| View tuning parameters | `src/store.ts` | `zRooms`/`zCards`/`timeT` are already user-tunable and persisted — precedent for a config object. |

### 2.2 Couplings that must be removed

1. **Hardcoded item schema.** `KnowledgeNode` (`src/data/generate.ts:5`) defines `wingId/wingName/roomId/roomName/title/body/tags/embedding/createdAt`. The view layer dereferences these by name in ~39 places across `NodeLabelLayer.tsx`, `DetailPanel.tsx`, `SearchBox.tsx`, `Board.tsx`, `DotsCanvas.tsx`, and `Minimap.tsx`; `Hud.tsx` additionally reads the two-level `world.rooms`/`world.wings` shape directly. The store's `addNode`/`addChild`/`updateNode` construct and patch these fields literally (`src/store/world.ts:150-230`).
2. **Exactly two grouping levels, string-parsed.** Wing/room are denormalized onto every node; hierarchy order is recovered by parsing `wing-N-room-M` id strings (`sortedWingIds`, `src/data/layout.ts:94`). Group color is `hsl(wingIndex*60+15, 70%, 62%)` hardcoded in `deriveWorld` and `wingHue`.
3. **Constants scattered across four files.** Zoom bounds (`MIN_ZOOM`/`MAX_ZOOM`, `src/store.ts:11-14`), LOD exponents (`1.45`, `PASS_START/FULL/GROW`, `FOCUS_R`, ring fraction `0.62`, `MAX_CHIPS`, all in `src/board/lod.ts`), layout radii (`WING_CIRCLE_RADIUS`, sigmas, `src/data/layout.ts:57-61`), interaction constants (`DRAG_THRESHOLD`, `DROP_RADIUS`, chip dims, `src/board/NodeLabelLayer.tsx:9-17`). None are injectable.
4. **Two singleton stores that import each other.** `src/store/world.ts` imports `useViewStore` (select-on-create, deselect-on-delete). Both stores are module-level singletons, so two embedded instances would share state.
5. **Demo semantics in copy.** "Untitled note", "memory palace", wing/room vocabulary, and toast strings are user-facing in the store and UI.
6. **Time dimension bound to the demo generator.** `timeFactor` depends on `TIME_MIN`/`TIME_MAX` recomputed at module load from the mock data (`src/data/generate.ts:251-252`).

---

## 3. Target Package Layout

A monorepo with two publishable packages and one example app:

```
cavin/
├── packages/
│   ├── core/                    → @cavin/core
│   │   ├── src/types.ts         CavinNode, NodeState, World, GroupCluster
│   │   ├── src/adapter.ts       SchemaAdapter interface + field descriptors
│   │   ├── src/derive.ts        deriveWorld (generic groups tree)
│   │   ├── src/commands.ts      Command types, applyCommand dispatch
│   │   ├── src/mutations.ts     reparent/promote/subtree/lock rules (pure)
│   │   ├── src/lod.ts           roomMorph, visibleNodes, revealZoom, …
│   │   ├── src/layout.ts        initial scatter layout (adapter-driven)
│   │   ├── src/config.ts        LayoutConfig with defaults
│   │   └── src/storage.ts       CavinStorage interface + localStorage impl
│   └── react/                   → @cavin/react
│       ├── src/CavinCanvas.tsx  the embeddable component + CavinProvider
│       ├── src/board/           Board, DotsCanvas, NodeLabelLayer, Minimap, ClusterLabels
│       ├── src/ui/              DetailPanel, SearchBox, Hud, DimensionSlider, Toast
│       └── src/registries.ts    renderer/editor/hotkey registries + defaults
└── examples/
    └── knowledge-palace/        the current app, rebuilt as a consumer
        ├── src/adapter.ts       KnowledgeAdapter (wing/room/title/body/tags/embedding)
        ├── src/generate.ts      the seeded mock palace (unchanged)
        └── src/App.tsx          <CavinCanvas adapter={knowledge} … />
```

**Dependency direction is one-way:** `examples/* → @cavin/react → @cavin/core`. Core imports nothing from React or the DOM. The React package never special-cases the knowledge schema.

**Build:** pnpm workspaces; TS project references; each package builds with `vite build` in lib mode (ESM + d.ts). Tests are per-package Vitest. Nothing is published to npm initially, but package boundaries are drawn as if they will be: no deep imports across packages, public API only through each package's `index.ts`.

---

## 4. Core Design (`@cavin/core`)

The core is the whole product minus pixels. Everything in this section is DOM-free and React-free.

### 4.1 Generic node model

```ts
/** What the framework needs to know about every item, however the host
    shapes its own data. `TAttr` is the host's attribute payload. */
export interface CavinNode<TAttr = unknown> {
  id: string
  /** Absent = root of a group; set = child of another node (room semantics). */
  parentId?: string
  /** 2D world position (world units = px at zoom 1). */
  position: [number, number]
  /** Cluster path, coarse → fine (replaces hardcoded wing/room). */
  groupPath: string[]
  /** Host-defined payload — title/body/tags/embedding in the demo. */
  attributes: TAttr
  state: NodeState
}

export interface NodeState {
  /** Cannot be moved, edited, or deleted until unlocked. */
  locked?: boolean
  /** Human-confirmed: future machine imports must not overwrite.
      Set/cleared with `locked` — locking IS confirming. */
  confirmed?: boolean
  /** Free-placed by the user: exempt from cluster/orbit home positions. */
  placed?: boolean
  /** Unplaced child's home offset from its parent. */
  relOffset?: [number, number]
}
```

Two deliberate moves relative to today's `LaidOutNode`:

- **`color`/`hue` leave the node.** Color is presentation, computed from `groupPath` via the adapter's `colorOf` (§4.2) at render time. This removes the "subtree inherits the parent's wing/room so colors stay consistent" mutation (`reparentNodes`, `src/data/layout.ts:436-447`) — colors follow the group path automatically.
- **`groupPath` replaces four denormalized fields.** Grouping becomes an arbitrary-depth list, and nothing anywhere parses id strings.

### 4.2 The plug point: `SchemaAdapter`

One object per host dataset. This is the only code an integrator must write.

```ts
export interface SchemaAdapter<TAttr> {
  /** Human name for an item ("note", "task", "organism") — drives all copy. */
  noun: string

  /** Cluster path for a node, coarse → fine. Length may vary per node;
      an empty array means "ungrouped" (renders as free space). */
  groupOf(node: CavinNode<TAttr>): string[]

  /** One-line label for chips, minimap, breadcrumb, toasts, search hits. */
  labelOf(node: CavinNode<TAttr>): string

  /** Optional richer text for search indexing; default searches labelOf. */
  searchTextOf?(node: CavinNode<TAttr>): string

  /** Optional color override for a group path; default = deterministic
      hue rotation over the top-level group (the current wingHue scheme). */
  colorOf?(groupPath: string[]): string

  /** Field descriptors driving the detail panel, search facets, and
      validation. See below. */
  fields: FieldDescriptor<TAttr>[]

  /** Validate a decoded record (persistence boundary). Drops, never throws. */
  validate(raw: unknown): CavinNode<TAttr> | null

  /** Attributes for a newly created node in the given group context. */
  createDefault(ctx: { groupPath: string[]; parentId?: string }): TAttr

  /** Optional initial-layout hint, e.g. an embedding vector. When present,
      the scatter layout uses it for similarity-scaled spread; when absent,
      layout is pure deterministic jitter. */
  layoutVectorOf?(node: CavinNode<TAttr>): number[] | undefined
}

export interface FieldDescriptor<TAttr> {
  /** Key into TAttr. */
  key: keyof TAttr & string
  label: string
  kind: 'text' | 'multiline' | 'tags' | 'number' | 'readonly'
  /** Placeholder / empty-state copy for the editor. */
  placeholder?: string
}
```

The demo's adapter is mechanical: `groupOf = [wingName, roomName]`, `labelOf = title`, `fields = [title, body, tags]`, `layoutVectorOf = embedding`, `validate` ≈ today's `validNode` (`src/data/persist.ts:31`). `createdAt` moves into attributes with a `number` field, and `TIME_MIN/TIME_MAX` are derived per-dataset at load instead of at module load.

### 4.3 Derived world: groups replace wings/rooms

`deriveWorld(nodes, adapter, prev?)` keeps every shipped invariant — orphan promotion to root, unplaced-child re-anchoring to `parent.position + relOffset`, free-placed roots excluded from cluster centroids, empty groups disappearing, previous-centroid retention when all roots go free-placed — but aggregates over `groupPath` instead of the two hardcoded levels:

```ts
export interface GroupCluster {
  /** The path prefix this cluster represents, e.g. ["Design"]. */
  path: string[]
  /** Display name = last segment; breadcrumb = the whole path. */
  name: string
  depth: number           // 0 = top level (today's wings), 1 = rooms, …
  centroid: [number, number]
  radius: number
  count: number
}

export interface World<TAttr = unknown> {
  nodes: CavinNode<TAttr>[]
  /** All clusters at all depths, sorted coarse → fine. Renderers slice by
      depth and current LOD thresholds instead of reading `wings`/`rooms`. */
  groups: GroupCluster[]
  nodeById: Map<string, CavinNode<TAttr>>
  groupByPath: Map<string, GroupCluster>   // key = path.join('\u0001')
  childrenByParent: Map<string, CavinNode<TAttr>[]>
  depthById: Map<string, number>
}
```

Renderers that today read `world.rooms`/`world.wings` (DotsCanvas, Minimap, ClusterLabels) switch to `world.groups` filtered by `depth`. The two-level demo renders identically; a host with zero or three grouping levels needs no framework change.

### 4.4 Command layer

Today's store actions become explicit commands — a discriminated union plus one dispatch function sitting exactly where `mutate()` sits now:

```ts
export type Command<TAttr = unknown> =
  | { type: 'add';      at: [number, number]; groupPath: string[] }
  | { type: 'addChild'; parentId: string }
  | { type: 'update';   id: string; patch: Partial<TAttr> }
  | { type: 'move';     id: string; to: [number, number] }
  | { type: 'reparent'; id: string; newParentId: string }
  | { type: 'promote';  id: string }
  | { type: 'resetPlacement'; id: string }
  | { type: 'setLocked'; id: string; locked: boolean }
  | { type: 'remove';   id: string }

export interface MutationResult<TAttr> {
  ok: boolean
  error?: MutationError   // today's TreeMutationError union, verbatim
  world?: World<TAttr>
  /** Presentation-neutral outcome notices ("rejoined orbit", "deleted 5").
      The UI maps these to toasts; the core never prints strings itself. */
  notice?: { kind: string; count?: number; targetId?: string }
}

export function applyCommand<TAttr>(
  world: World<TAttr>,
  cmd: Command<TAttr>,
  adapter: SchemaAdapter<TAttr>,
  config: LayoutConfig,
): MutationResult<TAttr>
```

Semantics are exactly the current store's, moved and de-stringified:

- **Lock rules:** `locked` blocks update/move/reparent/remove; locked branches shield subtrees in `deletableSubtree`/`movableSubtree` (already pure, unchanged).
- **Re-parent rules:** refuse cycles, missing nodes, locked node or target; dropping on the current parent re-joins the orbit (`kind: 'rejoined'`).
- **Move fast path:** the rAF-coalesced drag optimization (`src/store/world.ts:104-128`) becomes a core `applyDragFrame(world, id, pos)` helper so non-React hosts get the same behavior. Structural first-move (detach from orbit → `placed`) stays a full `deriveWorld`.
- **Notice strings leave the core.** `toastMutationError` and the toast copy live in the React package, keyed off `error`/`notice.kind`.

Why a command union rather than keeping the method-style store API: it gives one serializable, loggable representation of every edit — the precondition for undo/redo, an edit history panel, and eventually CRDT collaboration — without committing to building any of those now.

### 4.5 Storage: `CavinStorage`

Today's `WorldStorage` generalizes with two changes:

```ts
export interface CavinStorage<TAttr = unknown> {
  load(): CavinNode<TAttr>[] | null
  save(nodes: CavinNode<TAttr>[]): boolean
  clear(): void
  subscribe?(onChange: (nodes: CavinNode<TAttr>[] | null) => void): () => void
}
```

1. **Validation moves to the adapter.** `createLocalStorageCavinStorage(key, adapter)` calls `adapter.validate` per record (today's `validNode` behavior), keeping the fail-safe contract: quota, privacy mode, and corrupt payloads all behave as empty.
2. **The key is namespaced by the host** (`cavin:<host>:v1`), since multiple apps may embed the framework on one origin.

The async/backend question is deliberately deferred — see §9.

### 4.6 One configuration object: `LayoutConfig`

Every constant listed in §2.2.3 moves into a single structure with defaults equal to today's values, deep-merged over host overrides:

```ts
export interface LayoutConfig {
  camera:    { minZoom: 0.04; maxZoom: 9 }
  lod:       { zRooms: 0.15; zCards: 0.5; revealBase: 1.05; revealExponent: 1.45;
               revealSaturateDepth: 6; focusRadius: 320 }
  room:      { ringFraction: 0.62; radiusMin: 110; radiusPerChild: 62;
               passStart: 1.5; passFull: 2.6; passGrow: 2.2 }
  labels:    { maxChips: 200; chipHeight: 20; chipMaxWidth: 180;
               nameplateOpen: 0.45; declutterCell: 48 }
  layout:    { topLevelRadius: 1500; groupSpreadMin: 250; groupSpreadMax: 420;
               itemSigma: 55; childOrbitSigma: 18; hueStep: 60 }
  interaction: { dragThreshold: 4; dropRadius: 28 }
}
```

`zRooms`/`zCards` remain user-tunable at runtime (the existing HUD sliders), layered over the host's defaults. The demo ships with the defaults untouched — proof that the defaults preserve current behavior.

### 4.7 What stays exactly as-is

- The LOD/morph engine (`roomMorph`, `visibleNodes`, `revealZoom`, `zoomGate`, `focusFalloff`, `roomSlot`) — it already reads only framework-level fields; it just moves to `core/src/lod.ts` and takes `LayoutConfig` instead of module constants.
- The pure mutation invariants and their test suite (`src/data/layout.test.ts`), re-pointed at the generic types.
- `smoothstep`, the deterministic `hashRand` layout seeding, and the seeded palace generator (moves to the example app).

---

## 5. React Package Design (`@cavin/react`)

### 5.1 The component

```tsx
<CavinCanvas
  adapter={knowledgeAdapter}          // required — the data plug
  storage={createLocalStorageCavinStorage('palace', knowledgeAdapter)}  // optional
  config={{ lod: { zCards: 0.6 } }}   // optional overrides
  initialNodes={seededPalace}         // optional machine draft
  onMutation={(cmd, result) => …}     // optional observability hook
  renderers={{ detailFields: MyFields }}  // optional registry overrides
  className="h-full w-full"
/>
```

`initialNodes` + storage compose the boot rule, identical to today's `boot()` (`src/store/world.ts:64`): storage wins if present, else `initialNodes` laid out by the adapter, else empty.

### 5.2 Per-instance state

Both Zustand stores become **store factories** created in a React context (`CavinProvider`), fixing the singleton coupling of §2.2.4. The world store no longer imports the view store; cross-store effects (select-on-create, deselect-on-delete) move into a small event bus inside the provider, subscribed in `CavinCanvas`. This is the one structural change to the state layer; all selector-level code in the board/UI components is otherwise untouched.

### 5.3 Registries: how the UI goes schema-agnostic

Every place the UI currently dereferences a schema field gets its content through the adapter or an overridable registry slot:

| Surface | Today | Framework |
|---|---|---|
| Chip/label text | `node.title` | `adapter.labelOf(node)` |
| Cluster labels, minimap, breadcrumb | `wingName`/`roomName` | `GroupCluster.name` / `path` |
| Detail panel form | hardcoded title/body/tags inputs | generated from `adapter.fields`; wholesale replaceable via `renderers.detailFields` |
| Search | substring over title/tags/body | `adapter.searchTextOf` (default `labelOf`) |
| Dot/chip/cluster colors | `node.color`/`node.hue` | `adapter.colorOf` or default hue rotation |
| Toasts | literal strings in the store | `MutationResult.notice.kind` → message table in the UI, interpolated with `adapter.noun` |
| Hotkeys | N/C/L/Del/ESC in `Board.tsx` | default keymap, replaceable via `renderers.hotkeys` |
| Time slider | `createdAt` + module-load range | shown only if the adapter declares a numeric `kind: 'number'` field flagged as the time axis; range derived from data |

### 5.4 Rendering pipeline — unchanged

The three-layer pipeline (rAF-imperative `DotsCanvas`, imperative-DOM `NodeLabelLayer`, React islands for panels) and its per-frame dirty-checking move verbatim into the package. No rendering behavior is redesigned in this refactor; the only edits are the field accesses above.

---

## 6. Data Lifecycle & Progressive Editing Semantics

The framework's opinionated lifecycle, preserved from the PRD and now stated generically:

1. **Ingest (machine draft).** The host maps raw records to `CavinNode`s through its adapter and passes them as `initialNodes` (or through a storage implementation fed by its pipeline). Initial positions come from `core/src/layout.ts`, using `layoutVectorOf` when available.
2. **Refinement (human).** All edits are commands against the world (§4.4). Direct manipulation in the UI issues the same commands a headless script could.
3. **Confirmation.** Locking marks `locked` + `confirmed`; confirmed nodes reject every mutation and shield their subtrees from cascading deletes.
4. **Re-import.** A host applying a newer machine draft is expected to **merge around confirmed nodes** — the framework enforces this for commands issued through `applyCommand`; hosts writing storage directly get the contract documented in `CavinStorage`'s docstring (the PRD's "locked notes untouched by re-imports" story).
5. **Sync.** Storage `subscribe?` delivers external changes (another tab today, a server push tomorrow); the core re-derives and the UI follows. No CRDT — last writer wins, as today.

---

## 7. Migration Roadmap

Five phases, each independently testable, none breaking the demo. Phases P1–P2 happen in the current single-package layout; P3–P5 perform the physical split.

### P1 — Collect constants, decouple stores
- Introduce `LayoutConfig` (§4.6) in place; thread it through `lod.ts`, `layout.ts`, `NodeLabelLayer.tsx`, `store.ts`. Defaults = current literals.
- Break the `world.ts → store.ts` import: cross-store selection effects move to a subscription wired in `App.tsx`.
- **Exit:** all existing tests pass; demo behavior pixel-identical; grep finds no numeric LOD/layout literals outside `config.ts`.

### P2 — Generalize the node schema in place
- Introduce `CavinNode<TAttr>` + `SchemaAdapter`; express the knowledge schema as `KnowledgeAdapter` inside the app.
- `deriveWorld` aggregates `groups` over `groupPath`; renderers read `world.groups`.
- Field access in UI moves behind `labelOf`/`fields`/`searchTextOf`/`colorOf`.
- **Exit:** `layout.test.ts` green against generic types; demo unchanged; no file under `src/board|src/ui` mentions `wingId`, `roomName`, `title`, `tags`, or `embedding`.

### P3 — Extract `@cavin/core`
- pnpm workspace; move the pure layer (`types/derive/commands/mutations/lod/layout/config/storage`) into `packages/core`; the app imports it via the workspace alias.
- Re-express the store's actions as `applyCommand` calls; `mutate()` becomes the dispatcher.
- **Exit:** core has zero React/DOM imports (`tsc` with `"lib": ["ES2022"]` only); app suite green.

### P4 — Extract `@cavin/react`
- Move `board/` + `ui/` + store factories into `packages/react` behind `<CavinCanvas/>` and the registries (§5.3).
- **Exit:** the example app contains only adapter, seed data, and a thin `App.tsx`; a second minimal example (e.g. a flat task list with no grouping levels) mounts the same component against a 20-line adapter.

### P5 — Example app + release hygiene
- Move the palace to `examples/knowledge-palace`; write both packages' README/API docs from §4–§5 of this document.
- **Exit:** `pnpm build` produces ESM+d.ts for both packages; the stress-validation work already planned (5k–50k nodes) runs against `examples/knowledge-palace`.

---

## 8. Testing Strategy

- **Keep and port** `layout.test.ts` to `@cavin/core` — deriveWorld invariants (orphan promotion, child re-anchoring, centroid rules) and mutation rules (lock shielding, cycle guard, rejoin) are framework contract tests.
- **New: adapter conformance suite.** `@cavin/core/testing` exports `runAdapterConformance(adapter, samples)` asserting: `groupOf` never throws and returns strings; `createDefault` passes `validate`; `labelOf` returns non-empty; `validate` drops malformed records without throwing; `fields` keys exist on `attributes`. Every host adapter — starting with the demo's — runs the same suite.
- **New: command invariants.** Property-style tests over `applyCommand`: no command mutates the input world; locked nodes are unmoved by any command sequence; `reparent` can never create a cycle; `remove` never removes a locked descendant.
- **UI:** the second example app from P4 is the regression harness for "the framework is actually generic" — it must run with zero framework changes.

---

## 9. Non-Goals & Open Questions

**Non-goals** (reaffirmed): backend/accounts, real-time collaboration, undo/redo, multi-select, mobile input, a visual theming system.

**Open questions for reviewers:**

1. **Async storage.** `CavinStorage.load` is synchronous (localStorage-shaped). A real backend wants `Promise`s and partial sync. Options: (a) add an `AsyncCavinStorage` parallel interface later; (b) make load/save `| Promise` now, paying async boot complexity immediately. Proposal: (a) — YAGNI until the first backend host appears.
2. **CRDT seam.** If collaboration ever lands, is `Command` the right granularity to sync, or should it be node-level operations? The command union keeps both options open; no decision needed now.
3. **Where does 5k–50k stress validation live?** Proposal: a script + optional HUD overlay in `examples/knowledge-palace`, not in the packages — performance is validated against a real consumer, and the packages stay free of benchmark scaffolding.
4. **Adapter versioning.** Persisted data outlives adapters. Should `CavinStorage` records carry an adapter version + migrate hook? Proposal: defer; document that hosts should namespace storage keys by version (`cavin:palace:v1`) until a real migration need appears.
