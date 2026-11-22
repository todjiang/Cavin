import { useEffect, useState } from 'react'
import type {
  CavinEdge,
  CavinNode,
  CavinStorage,
  Command,
  DeepPartial,
  LayoutConfig,
  MutationResult,
  SchemaAdapter,
} from '@cavin/core'
import { layoutConfig, mergeConfig } from '@cavin/core'
import { CavinContext } from './context'
import type { CavinContextValue } from './context'
import { createViewStore } from './view-store'
import { createWorldStore } from './world-store'
import { createFrameHolder } from './frame'
import { syncSelection } from './selection'
import { defaultKeymap } from './keymap'
import type { Keymap } from './keymap'
import type { CavinRenderers } from './renderers'
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
 * Boot rule: the persisted snapshot wins when present (an emptied world
 * reloads empty), else `initialNodes`/`initialEdges`, else an empty world.
 */
export interface CavinCanvasProps<TAttr> {
  /** Required — the data plug. */
  adapter: SchemaAdapter<TAttr>
  /** Snapshot persistence ({ nodes, confirmedEdges }); omit for in-memory. */
  storage?: CavinStorage<TAttr>
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
  /** Observe every edit: called with each command and its result (the
      command layer's loggable representation — audit, sync, telemetry). */
  onMutation?: (cmd: Command<TAttr>, result: MutationResult<TAttr>) => void
  /** Override hotkey bindings; merged over the defaults. */
  keymap?: Partial<Keymap>
  /** Replace generated UI pieces (detail-form fields) without forking. */
  renderers?: CavinRenderers<TAttr>
  className?: string
}

export function CavinCanvas<TAttr>(props: CavinCanvasProps<TAttr>) {
  const [value] = useState(() => {
    // Resolve once per mount: the merged config is THE config for this
    // canvas — context, view store, world store and every render layer
    // read it from here, so a host override reaches the pixels.
    const config: LayoutConfig = mergeConfig(
      layoutConfig,
      props.config ?? ({} as DeepPartial<LayoutConfig>),
    )
    const view = createViewStore({
      storageKey: props.viewStorageKey,
      urlSync: props.urlSync,
      config,
    })
    const keymap: Keymap = { ...defaultKeymap, ...props.keymap }
    return { adapter: props.adapter, title: props.title, config, view, keymap, renderers: props.renderers }
  })

  const [stores] = useState(() => {
    // The world store needs a selection seam into the view store (create
    // actions select the new node). The stores never import each other:
    // the canvas injects the callback — a real call between two modules —
    // and syncSelection enforces the cross-store invariants.
    const world = createWorldStore<TAttr>({
      adapter: props.adapter,
      config: props.config,
      storage: props.storage,
      initialNodes: props.initialNodes,
      initialEdges: props.initialEdges,
      onSelectRequest: (id) => value.view.getState().select(id),
      onMutation: props.onMutation,
    })
    const frame = createFrameHolder(value.config)
    return { world, frame }
  })

  useEffect(() => syncSelection(value.view, stores.world), [value.view, stores.world])

  // Teardown: selection sync AND the world store's session subscriptions
  // (persistence timer, external-storage listener) plus any pending editor
  // frame — nothing survives unmount.
  useEffect(
    () => () => {
      stores.world.getState().dispose()
    },
    [stores.world],
  )

  return (
    <CavinContext.Provider value={{ ...value, ...stores } as unknown as CavinContextValue}>
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
