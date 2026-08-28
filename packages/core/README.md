# @cavin/core

The headless, schema-agnostic engine for **progressive data editing** — the whole
product minus pixels. DOM-free and React-free (`tsc` typechecks it against
`lib: ["ES2022"]` only); the React canvas and every example app are downstream
consumers.

## Install / build

```bash
npm run build      # tsc -b → dist/ (ESM + d.ts)
npm test           # the framework contract tests live here
```

## Public API (`@cavin/core`)

| Module | Exports | Role |
|---|---|---|
| `types` | `CavinNode<TAttr>`, `NodeState`, `GroupCluster`, `World`, `Camera`, `SelectionFocus`, `TreeMutationError` | The generic node model. `groupPath` is the cluster path (coarse → fine, replaces any hardcoded wing/room); `attributes` is the host payload; `state` carries locks/placement. |
| `adapter` | `SchemaAdapter<TAttr>`, `FieldDescriptor` | **The plug point.** One object per host dataset: `noun`, `groupOf`, `labelOf`, `searchTextOf?`, `colorOf?`, `fields`, `validate`, `createDefault`, `layoutVectorOf?`. |
| `commands` | `Command`, `applyCommand`, `applyDragFrame`, `newId` | Every structural edit is one serializable command dispatched through `applyCommand(world, cmd, adapter, config, rand?) → MutationResult`. Lock shielding, cycle guards, orbit re-join — all here. Notice/error kinds come back as data; the UI owns the copy. |
| `layout` | `deriveWorld`, `layoutNodes`, `reparentNodes`, `promoteToRootNodes`, `focusForSelection`, `deletableSubtree`, `movableSubtree`, `timeFactor`, `groupPathKey` | Pure derives and mutations. `deriveWorld(nodes, adapter, prev?, confirmedEdges?, config?)` aggregates `world.groups` over `groupPath` at arbitrary depth. |
| `lod` | `roomMorph`, `visibleNodes`, `revealZoom`, `zoomGate`, `focusFalloff`, `lodLevels`, `roomRadius`, `roomSlot`, `focusRingTargets` | The zoom-driven room-morph engine — pure functions of `(world, camera, zoom, thresholds)`. |
| `edges` | `CavinEdge`, `WorldEdge`, `suggestEdges`, `mergeEdges`, `indexEdgesByNode` | Machine-suggested + human-confirmed cross-domain connections; weak references, dropped at derive when an endpoint vanishes. |
| `config` | `layoutConfig`, `LayoutConfig`, `mergeConfig` | Every layout/LOD/interaction tuning constant, with deep-merged host overrides. |
| `storage` | `CavinStorage`, `createMemoryCavinStorage`, `validateRecords` | The persistence interface (node array only; edges are the host's concern). The localStorage implementation ships in `@cavin/react` — it touches the DOM, and the core must not. |
| `accessors` | `labelOf`, `searchTextOf`, `tagsOf`, `bodyOf`, `timeOf`, `timeFieldOf`, `timeRangeOf` | Schema-agnostic field access; the only way to read item content. |
| `colors` | `defaultHue`, `hsl`, `hsla`, `withAlpha`, `hueFromColor` | Presentation colors. Nodes/clusters never carry color — renderers derive it from `groupPath` via `adapter.colorOf` (or the default first-encounter hue rotation). |
| `testing` (`@cavin/core/testing`) | `runAdapterConformance` | The adapter conformance suite every host adapter should run. |

## Headless usage

```ts
import { deriveWorld, applyCommand, layoutNodes } from '@cavin/core'

const world = deriveWorld(initialNodes, adapter)
const res = applyCommand(world, { type: 'reparent', id: 'a', newParentId: 'b' }, adapter)
if (res.ok) persist(res.world.nodes)
```

Tests, importers, and non-React hosts drive the full editing semantics without
mounting any UI — `packages/core/src/*.test.ts` is exactly that.

## Dev resolution

The package resolves to **TS source** (`exports: "." → ./src/index.ts`) so dev
servers and Vitest consume it with no build step. `npm run build` emits
`dist/` (ESM + declarations) as the publishability proof; nothing is published
to npm yet.
