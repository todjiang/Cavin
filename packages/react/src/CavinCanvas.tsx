import { useEffect, useState } from 'react'
import type {
  CavinEdge,
  CavinNode,
  CavinStorage,
  DeepPartial,
  LayoutConfig,
  SchemaAdapter,
} from '@cavin/core'
import { CavinContext } from './context'
import type { CavinContextValue } from './context'
import { createViewStore } from './view-store'
import { createWorldStore } from './world-store'
import type { WorldStore } from './world-store'
import { Board } from './board/Board'
import { Minimap } from './board/Minimap'
import { Hud } from './ui/Hud'
import { DetailPanel } from './ui/DetailPanel'
import { SearchBox } from './ui/SearchBox'
import { ToastStack } from './ui/Toast'
import { ErrorBoundary } from './ui/ErrorBoundary'
import './styles.css'

/**
 * The embeddable canvas. One instance = one adapter + its own stores and
 * DOM world; mount two on a page and they stay independent.
 *
 * Boot rule: storage wins if it holds nodes, else `initialNodes`, else an
 * empty world.
 */
export interface CavinCanvasProps<TAttr> {
  /** Required — the data plug. */
  adapter: SchemaAdapter<TAttr>
  /** Node persistence; omit for an in-memory canvas. */
  storage?: CavinStorage<TAttr>
  /** Confirmed-edge persistence (the core's CavinStorage is node-only). */
  edgesStore?: { load(): CavinEdge[] | null; save(edges: CavinEdge[]): boolean; clear(): void }
  /** The machine draft this canvas edits (first boot and resets). */
  initialNodes?: CavinNode<TAttr>[]
  initialEdges?: CavinEdge[]
  /** Deep-merged over the core LayoutConfig defaults. */
  config?: DeepPartial<LayoutConfig>
  /** HUD heading (e.g. "memory palace"). */
  title?: string
  /** Mirror the camera into ?x=&y=&zoom= (shareable views). Default false. */
  urlSync?: boolean
  /** localStorage key for view tuning (LOD sliders, font). Omit → session-only. */
  viewStorageKey?: string
  className?: string
}

export function CavinCanvas<TAttr>(props: CavinCanvasProps<TAttr>) {
  const [value] = useState(() => {
    const view = createViewStore({
      storageKey: props.viewStorageKey,
      urlSync: props.urlSync,
    })
    const world = createWorldStore<TAttr>({
      adapter: props.adapter,
      config: props.config,
      storage: props.storage,
      edgesStore: props.edgesStore,
      initialNodes: props.initialNodes,
      initialEdges: props.initialEdges,
    })
    return { adapter: props.adapter, title: props.title, view, world }
  })

  useSelectionBridge(value.view, value.world)

  return (
    <CavinContext.Provider value={value as unknown as CavinContextValue}>
      <ErrorBoundary>
        <div className={`app${props.className ? ` ${props.className}` : ''}`}>
          <Board />
          <Hud />
          <SearchBox />
          <Minimap />
          <DetailPanel />
          <ToastStack />
        </div>
      </ErrorBoundary>
    </CavinContext.Provider>
  )
}

/** Bridge between the world and view stores, wired per canvas so the stores
    never import each other:
    - world actions that need a selection change (add note/child) set
      `requestedSelection`; we apply it to the view store.
    - whenever the world changes, a selectedId that no longer exists
      (deleted, or wiped by the reset) is cleared. */
function useSelectionBridge<TAttr>(view: CavinContextValue['view'], world: WorldStore<TAttr>): void {
  useEffect(() => {
    return world.subscribe((s, prev) => {
      if (s.requestedSelection && s.requestedSelection !== prev.requestedSelection) {
        view.getState().select(s.requestedSelection.id)
      }
      if (s.world !== prev.world) {
        const sel = view.getState().selectedId
        if (sel && !s.world.nodeById.has(sel)) view.getState().select(null)
      }
    })
  }, [view, world])
}
