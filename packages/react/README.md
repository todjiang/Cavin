# @cavin/react

The optional React layer over [`@cavin/core`](../core): the zoomable spatial
canvas, its render layers and UI panels, packaged as one embeddable component.

## Install / build

```bash
npm run build      # tsc -b → dist/ (ESM + d.ts) + styles.css
```

## Usage

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CavinCanvas, createLocalStorageCavinStorage } from '@cavin/react'
import { myAdapter } from './adapter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CavinCanvas
      adapter={myAdapter}                                   // required — the data plug
      storage={createLocalStorageCavinStorage('cavin:my-app:v1', myAdapter)}
      initialNodes={myMachineDraft}                         // optional seed (storage wins on boot)
      config={{ lod: { zCards: 0.6 } }}                     // optional LayoutConfig overrides
      title="my app"                                        // optional HUD heading
      urlSync                                               // optional ?x=&y=&zoom= camera sharing
      viewStorageKey="cavin-view:my-app"                    // optional persisted LOD sliders
    />
  </StrictMode>,
)
```

Boot rule: storage wins if it holds nodes, else `initialNodes`, else an empty
world. One instance = one adapter + its own stores and DOM world, so two
canvases coexist on one page (pass different storage keys).

## What's inside

- **`CavinCanvas`** — the composition root. Creates the per-instance view and
  world stores (store *factories*, never module singletons) and wires the
  selection bridge between them.
- **`board/`** — `Board` (pan/zoom/hotkeys), `DotsCanvas` (rAF-imperative
  canvas: dots, room walls, edges, cluster blobs), `NodeLabelLayer`
  (imperative-DOM chips with drag/re-parent/edit), `ClusterLabels`, `Minimap`.
- **`ui/`** — `DetailPanel` (form generated from `adapter.fields`), `SearchBox`,
  `Hud`, `DimensionSlider` (renders only when the adapter flags a time axis),
  `Toast`, `ErrorBoundary`.
- **Toast copy** — the core returns notice/error *kinds*; this package maps
  them to strings interpolated with `adapter.noun`.
- **`createLocalStorageCavinStorage(key, adapter, { fallbackKeys })`** — the
  doc's localStorage persistence, validated through `adapter.validate` per
  record. `fallbackKeys` is the migration seam: legacy records are decoded by
  the same adapter and the next save writes only the new key. The core's
  `CavinStorage` carries nodes only; confirmed edges persist via
  `createLocalStorageEdges(key)` (or a custom `edgesStore`).

Nothing here special-cases any schema — `examples/flat-tasks` mounts the same
component against a 20-line adapter with zero grouping levels.
