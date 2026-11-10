import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type {
  CavinEdge,
  CavinNode,
  CavinStorage,
  Command,
  DeepPartial,
  LayoutConfig,
  MutationResult,
  SchemaAdapter,
  World,
  WorldEdge,
} from '@cavin/core'
import { applyCommand, createMemoryCavinStorage, layoutConfig, mergeConfig, subtree } from '@cavin/core'
import { createSuggestionCache } from './suggestions'
import { createSession } from './session'
import { createEditor } from './editor'
import { errorText, noticeToast } from './notices'

/**
 * The world store — a thin zustand shell. One store per mounted canvas
 * (never a module singleton). Every editing action dispatches through the
 * core command funnel (`applyCommand`); the heavy lifting lives elsewhere:
 *
 * - session.ts — boot / reset / debounced persistence (storage wins else
 *   draft) and the suggestion-list bookkeeping;
 * - editor.ts — the frame-coalesced drag buffer (one `move` command per
 *   frame, so drags travel through applyCommand like every other edit);
 * - notices.ts — mutation-result → toast copy;
 * - selection.ts (via the injected `onSelectRequest`) — the world store's
 *   selection requests reach the view store without the two importing each
 *   other.
 */

export interface ToastMsg {
  id: number
  text: string
}

export interface WorldStoreOptions<TAttr> {
  adapter: SchemaAdapter<TAttr>
  /** Deep-merged over the core defaults. */
  config?: DeepPartial<LayoutConfig>
  /** Snapshot persistence ({ nodes, confirmedEdges }). Omit for in-memory worlds. */
  storage?: CavinStorage<TAttr>
  /** The machine draft this canvas edits (first boot, and demo resets). */
  initialNodes?: CavinNode<TAttr>[]
  initialEdges?: CavinEdge[]
  /**
   * Selection seam: the canvas injects a callback that applies selection
   * requests to the view store (create actions select the new node). The
   * stores never import each other — this callback IS the call between them.
   */
  onSelectRequest?: (id: string | null) => void
  /**
   * The one observability hook the command layer was designed for: called
   * with every command and its result, errors included — a host can log,
   * audit or sync edits without forking the component.
   */
  onMutation?: (cmd: Command<TAttr>, result: MutationResult<TAttr>) => void
}

export interface WorldState<TAttr = unknown> {
  adapter: SchemaAdapter<TAttr>
  config: LayoutConfig
  world: World<TAttr>
  /** Node currently open in edit mode in the DetailPanel. The invariant
      `editingId === selectedId` (view store) is enforced centrally by
      selection.ts — not by comparisons at read sites. */
  editingId: string | null
  toasts: ToastMsg[]

  /** Create a root at a world position in the nearest group; selects + opens editor. */
  addNode: (at: [number, number]) => string
  /** Create a child of the given node; selects + opens editor. */
  addChild: (parentId: string) => string
  /** Apply an attribute patch (keys from the adapter's field descriptors).
      No-op (toast) when locked. */
  updateNode: (id: string, patch: Record<string, unknown>) => void
  /** Move + free-place a node; the movable subtree follows (locked branches stay). */
  moveNode: (id: string, pos: [number, number]) => void
  /** Re-parent a node under another (drag-drop or panel picker); the subtree
      crosses into the new parent's group. Refuses cycles and locked targets.
      Dropping a free-placed child back onto its current parent re-joins the
      orbit. */
  reparentNode: (id: string, newParentId: string) => void
  /** Promote a child to a root (drag-to-empty or panel picker); pinned where
      it sits, children stay attached. */
  promoteNode: (id: string) => void
  /** Return a free-placed root to its cluster / a dragged child to its orbit. */
  resetToGrid: (id: string) => void
  toggleLock: (id: string) => void
  /** Cascade delete: the node + descendants, minus locked branches. No-op (toast) when locked. */
  removeNode: (id: string) => void
  /** Create a directed semantic relation through the core command funnel. */
  connectNodes: (from: string, to: string, predicate: string) => MutationResult
  /** Promote a machine-suggested connection to human-confirmed (persisted). */
  confirmEdge: (edge: WorldEdge) => void
  /** Remove a confirmed connection. */
  unlinkEdge: (id: string) => void
  /** Wipe persistence and rebuild from `initialNodes`. */
  resetDemo: () => void

  setEditing: (id: string | null) => void
  toast: (text: string) => void
  dismissToast: (id: number) => void
}

export type WorldStore<TAttr = unknown> = UseBoundStore<StoreApi<WorldState<TAttr>>>

export function createWorldStore<TAttr>(options: WorldStoreOptions<TAttr>): WorldStore<TAttr> {
  const adapter = options.adapter
  const config = mergeConfig(layoutConfig, options.config ?? ({} as DeepPartial<LayoutConfig>))
  const storage = options.storage ?? createMemoryCavinStorage<TAttr>()
  const onSelectRequest = options.onSelectRequest ?? (() => {})
  // Per-instance toast id counter (was module state — two stores on one page
  // shared it).
  let toastSeq = 0

  const session = createSession<TAttr>({
    adapter,
    config,
    storage,
    suggestions: createSuggestionCache<TAttr>(adapter, config.edges),
    initialNodes: options.initialNodes,
    initialEdges: options.initialEdges,
  })

  const store = create<WorldState<TAttr>>()((set, get) => {
    // Frame-coalesced drag: the editor buffers pointermove positions and
    // flushes ONE move command per frame — drags travel through
    // applyCommand like every other edit, with full observability.
    const editor = createEditor({
      dispatch: (cmd) => {
        dispatch(cmd)
      },
    })

    /** Dispatch through the core command funnel; surface notices/toasts. */
    const dispatch = (cmd: Parameters<typeof applyCommand<TAttr>>[1]) => {
      const res = applyCommand(get().world, cmd, adapter, config)
      options.onMutation?.(cmd, res)
      if (!res.ok) {
        const text = res.error ? errorText(adapter.noun, res.error) : null
        if (text) get().toast(text)
        return res
      }
      if (res.world) {
        // Suggestions are the session's job: withFreshSuggestions re-derives
        // only when the suggestion cache says the inputs changed.
        set({ world: session.withFreshSuggestions(res.world) })
      }
      if (res.notice) {
        const text = noticeToast(adapter, get().world, res.notice)
        if (text) get().toast(text)
      }
      return res
    }

    const selectAndEdit = (id: string) => {
      onSelectRequest(id)
      set({ editingId: id })
    }

    return {
      adapter,
      config,
      world: session.boot(),
      editingId: null,
      toasts: [],

      addNode: (at) => {
        const res = dispatch({ type: 'add', at })
        const id = res.createdId ?? ''
        if (id) selectAndEdit(id)
        return id
      },

      addChild: (parentId) => {
        const res = dispatch({ type: 'addChild', parentId })
        const id = res.createdId ?? ''
        if (id) {
          // Selecting the new child flies the camera to it; Board zooms to
          // reveal its depth automatically (zoom = hierarchy, no expand flags).
          selectAndEdit(id)
        }
        return id
      },

      updateNode: (id, patch) => {
        dispatch({ type: 'update', id, patch: patch as Partial<TAttr> })
      },

      moveNode: (id, pos) => {
        // Drag guard stays silent; the label layer toasts once on drag start.
        const node = get().world.nodeById.get(id)
        if (!node || node.state.locked) return
        if (!node.state.placed) {
          // First move detaches the node from its orbit — that must land
          // immediately (the drag seed depends on it), not at frame end.
          dispatch({ type: 'move', id, to: pos })
          return
        }
        editor.bufferMove(id, pos)
      },

      reparentNode: (id, newParentId) => {
        dispatch({ type: 'reparent', id, newParentId })
      },

      promoteNode: (id) => {
        dispatch({ type: 'promote', id })
      },

      resetToGrid: (id) => {
        dispatch({ type: 'resetPlacement', id })
      },

      toggleLock: (id) => {
        const node = get().world.nodeById.get(id)
        if (!node) return
        dispatch({ type: 'setLocked', id, locked: !node.state.locked })
        if (!node.state.locked && get().editingId === id) set({ editingId: null })
      },

      removeNode: (id) => {
        const doomed = subtree(get().world, id)
        dispatch({ type: 'remove', id })
        // Selection cleanup happens in selection.ts: the deleted ids are no
        // longer in the world, so a stale selectedId is cleared there.
        set((s) => ({ editingId: s.editingId && doomed.has(s.editingId) ? null : s.editingId }))
      },

      confirmEdge: (edge) => {
        dispatch({ type: 'confirmEdge', edge: { ...edge } })
      },

      connectNodes: (from, to, predicate) =>
        dispatch({ type: 'connect', from, to, predicate }),

      unlinkEdge: (id) => {
        dispatch({ type: 'removeEdge', id })
      },

      resetDemo: () => {
        set({ world: session.reset(), editingId: null })
        get().toast('Demo data restored')
      },

      setEditing: (id) => set({ editingId: id }),

      toast: (text) => set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, text }] })),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }
  })

  // Debounced snapshot persistence — owned by the session module.
  session.persistOnChange(store, (text) => store.getState().toast(text))

  return store
}
