import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type {
  CavinEdge,
  CavinNode,
  CavinStorage,
  DeepPartial,
  LayoutConfig,
  MutationNotice,
  SchemaAdapter,
  TreeMutationError,
  World,
  WorldEdge,
} from '@cavin/core'
import {
  applyCommand,
  createMemoryCavinStorage,
  deletableSubtree,
  deriveWorld,
  labelOf,
  layoutConfig,
  mergeConfig,
} from '@cavin/core'
import { createSuggestionCache } from './suggestions'

/**
 * The world store factory — one store per mounted canvas (never a module
 * singleton, so two canvases can coexist on one page). Every editing action
 * is a thin wrapper over `applyCommand`: the mutation semantics live in the
 * core, and this layer only maps results to toasts, selection requests, and
 * debounced persistence.
 *
 * Persistence is one snapshot (`{ nodes, confirmedEdges }`) behind one
 * `CavinStorage`. The confirmed-edge list is not stored separately: it is
 * recovered from `world.edges` at the persistence boundary, and every
 * command re-derives with the post-command confirmed list, so the renderable
 * world is always the source of truth.
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
}

export interface WorldState<TAttr = unknown> {
  adapter: SchemaAdapter<TAttr>
  config: LayoutConfig
  world: World<TAttr>
  /** Node currently open in edit mode in the DetailPanel (must equal selectedId). */
  editingId: string | null
  toasts: ToastMsg[]
  /**
   * Selection request for the view layer. The world store is deliberately
   * decoupled from the view store: instead of calling `select()` directly,
   * actions set this field and the canvas composition applies it — along
   * with clearing the selection when the selected node disappears from the
   * world (delete / reset).
   */
  requestedSelection: { id: string | null } | null

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

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** Notice-kind → user-facing copy, interpolated with the adapter's noun. */
function noticeText(noun: string, notice: MutationNotice): string | null {
  switch (notice.kind) {
    case 'created':
      return `${cap(noun)} created`
    case 'child-created':
      return `Child ${noun} created`
    case 'saved':
      return 'Saved'
    case 'rejoined':
    case 'reset-orbit':
      return 'Back in orbit'
    case 'reset-root':
      return 'Back in the grid'
    case 'promoted':
      return `Promoted to a root ${noun}`
    case 'locked':
      return `${cap(noun)} locked & confirmed`
    case 'unlocked':
      return `${cap(noun)} unlocked`
    case 'deleted':
      return notice.count && notice.count > 1
        ? `Deleted ${notice.count} ${noun}s`
        : `${cap(noun)} deleted`
    case 'edge-confirmed':
      return 'Connection confirmed'
    case 'edge-removed':
      return 'Connection removed'
    case 'reparented':
      return null // resolved by the caller against the new parent's label
  }
}

/** Error-kind → user-facing copy; silent for no-ops (missing/self/noop). */
function errorText(noun: string, error: TreeMutationError): string | null {
  switch (error) {
    case 'locked-node':
      return `${cap(noun)} is locked — unlock it first`
    case 'locked-target':
      return 'Target is locked — unlock it first'
    case 'cycle':
      return `Can’t nest a ${noun} inside its own descendant`
    default:
      return null
  }
}

const confirmedOf = <TAttr>(world: World<TAttr>): CavinEdge[] =>
  world.edges.filter((e) => e.kind === 'confirmed')

export type WorldStore<TAttr = unknown> = UseBoundStore<StoreApi<WorldState<TAttr>>>

export function createWorldStore<TAttr>(options: WorldStoreOptions<TAttr>): WorldStore<TAttr> {
  const adapter = options.adapter
  const config = mergeConfig(layoutConfig, options.config ?? ({} as DeepPartial<LayoutConfig>))
  const storage = options.storage ?? createMemoryCavinStorage<TAttr>()
  const noun = adapter.noun
  // Per-instance toast id counter (was module state — two stores on one page
  // shared it).
  let toastSeq = 0
  // Call-site owner of the machine-suggestion list (recomputes only when the
  // inputs suggestEdges reads actually change). `appliedSuggested` tracks
  // which cache array the current world was derived with — identity-equal
  // means no suggestion input changed, so no re-derive is needed.
  const suggestions = createSuggestionCache<TAttr>(adapter)
  let appliedSuggested: CavinEdge[] = []

  /** Boot: restore the persisted snapshot if present, else the initial draft. */
  function boot(): World<TAttr> {
    try {
      const stored = storage.load()
      if (stored) {
        const suggested = suggestions.suggest(stored.nodes)
        appliedSuggested = suggested
        return deriveWorld(
          stored.nodes,
          adapter,
          undefined,
          stored.confirmedEdges,
          config,
          suggested,
        )
      }
    } catch {
      // Corrupt shape — fall through to the initial draft.
    }
    const nodes = options.initialNodes ?? []
    const suggested = suggestions.suggest(nodes)
    appliedSuggested = suggested
    return deriveWorld(nodes, adapter, undefined, options.initialEdges ?? [], config, suggested)
  }

  const store = create<WorldState<TAttr>>()((set, get) => {
    /** Dispatch through the core command funnel; surface notices/toasts. */
    const dispatch = (cmd: Parameters<typeof applyCommand<TAttr>>[1]) => {
      const res = applyCommand(get().world, cmd, adapter, config)
      if (!res.ok) {
        const text = res.error ? errorText(noun, res.error) : null
        if (text) get().toast(text)
        return res
      }
      if (res.world) {
        let world = res.world
        // Suggestions are the call site's job: the cache returns the SAME
        // array identity when the inputs (top-level group, layout vectors)
        // are unchanged — only then is the world's suggestion list still
        // correct and a re-derive skipped.
        const suggested = suggestions.suggest(world.nodes)
        if (suggested !== appliedSuggested) {
          appliedSuggested = suggested
          world = deriveWorld(world.nodes, adapter, world, confirmedOf(world), config, suggested)
        }
        set({ world })
      }
      if (res.notice) {
        if (res.notice.kind === 'reparented') {
          const parent = get().world.nodeById.get(res.notice.targetId ?? '')
          get().toast(`Moved under “${parent ? labelOf(adapter, parent) : noun}”`)
        } else {
          const text = noticeText(noun, res.notice)
          if (text) get().toast(text)
        }
      }
      return res
    }

    // Frame-coalesced drag: pointermove can exceed 60Hz, but a drag's position
    // update only needs to land once per frame. Buffered target, flushed as a
    // single `move` command per frame — the command re-derives, keeping every
    // world index consistent (derive is cheap now that suggestions live
    // outside it).
    let pendingMove: { id: string; pos: [number, number] } | null = null
    let moveRaf = 0
    const flushMove = () => {
      moveRaf = 0
      if (!pendingMove) return
      const { id, pos } = pendingMove
      pendingMove = null
      dispatch({ type: 'move', id, to: pos })
    }

    return {
      adapter,
      config,
      world: boot(),
      editingId: null,
      toasts: [],
      requestedSelection: null,

      addNode: (at) => {
        const res = dispatch({ type: 'add', at })
        const id = res.createdId ?? ''
        if (id) set({ requestedSelection: { id }, editingId: id })
        return id
      },

      addChild: (parentId) => {
        const res = dispatch({ type: 'addChild', parentId })
        const id = res.createdId ?? ''
        if (id) {
          // Selecting the new child flies the camera to it; Board zooms to
          // reveal its depth automatically (zoom = hierarchy, no expand flags).
          set({ requestedSelection: { id }, editingId: id })
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
          dispatch({ type: 'move', id, to: pos })
          return
        }
        pendingMove = { id, pos }
        if (!moveRaf) moveRaf = requestAnimationFrame(flushMove)
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
        const doomed = deletableSubtree(get().world, id)
        dispatch({ type: 'remove', id })
        // Selection cleanup happens in the canvas bridge: the deleted ids are
        // no longer in the world, so a stale selectedId is cleared there.
        set((s) => ({ editingId: s.editingId && doomed.has(s.editingId) ? null : s.editingId }))
      },

      confirmEdge: (edge) => {
        dispatch({ type: 'confirmEdge', edge: { ...edge } })
      },

      unlinkEdge: (id) => {
        dispatch({ type: 'removeEdge', id })
      },

      resetDemo: () => {
        storage.clear()
        const nodes = options.initialNodes ?? []
        const suggested = suggestions.suggest(nodes)
        appliedSuggested = suggested
        set({
          world: deriveWorld(nodes, adapter, undefined, options.initialEdges ?? [], config, suggested),
          editingId: null,
        })
        get().toast('Demo data restored')
      },

      setEditing: (id) => set({ editingId: id }),

      toast: (text) => set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, text }] })),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }
  })

  // Persist the whole snapshot (nodes + confirmed edges recovered from the
  // renderable world) whenever the world changes. Debounced; a failed save
  // surfaces as a one-shot toast so the user knows persistence stopped.
  let saveTimer: number | undefined
  let lastSaveWarned = false
  store.subscribe((s, prev) => {
    if (s.world === prev.world) return
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      const world = store.getState().world
      const ok = storage.save({
        nodes: world.nodes,
        confirmedEdges: confirmedOf(world),
      })
      if (!ok && !lastSaveWarned) {
        lastSaveWarned = true
        store.getState().toast('Storage full — changes won’t persist')
      } else if (ok) {
        lastSaveWarned = false
      }
    }, 300)
  })

  return store
}
