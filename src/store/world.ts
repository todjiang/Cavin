import { create } from 'zustand'
import type { LaidOutNode, World } from '../data/layout'
import {
  buildInitialWorld,
  deletableSubtree,
  deriveWorld,
  movableSubtree,
  promoteToRootNodes,
  reparentNodes,
} from '../data/layout'
import type { TreeMutationError } from '../data/layout'
import type { CavinEdge, WorldEdge } from '../data/edges'
import { worldStorage } from '../data/persist'
import { layoutConfig } from '../config'
import { knowledgeAdapter } from '../demo/adapter'

const { layout: LAYOUT } = layoutConfig

export interface ToastMsg {
  id: number
  text: string
}

export interface NodePatch {
  title?: string
  body?: string
  tags?: string[]
}

export interface WorldState {
  world: World
  /** Human-confirmed cross-domain connections (persisted). The renderable
      edge list — confirmed + machine-suggested — lives on `world.edges`. */
  edges: CavinEdge[]
  /** Node currently open in edit mode in the DetailPanel (must equal selectedId). */
  editingId: string | null
  toasts: ToastMsg[]
  /**
   * Selection request for the view layer. The world store is deliberately
   * decoupled from the view store: instead of calling `select()` directly,
   * actions set this field and a subscription wired at the composition root
   * (App.tsx) applies it — along with clearing the selection when the
   * selected node disappears from the world (delete / demo reset).
   */
  requestedSelection: { id: string | null } | null

  /** Create a root note at a world position in the nearest room; selects + opens editor. */
  addNode: (at: [number, number]) => string
  /** Create a child of the given note; expands the chain, selects + opens editor. */
  addChild: (parentId: string) => string
  /** Edit title/body/tags. No-op (toast) when locked. */
  updateNode: (id: string, patch: NodePatch) => void
  /** Move + free-place a node; the movable subtree follows (locked branches stay). */
  moveNode: (id: string, pos: [number, number]) => void
  /** Re-parent a node under another (drag-drop or panel picker); the subtree
      inherits the new parent's wing/room context. Refuses cycles and locked
      targets. Dropping a free-placed child back onto its current parent
      re-joins the orbit. */
  reparentNode: (id: string, newParentId: string) => void
  /** Promote a child to a root (drag-to-empty or panel picker); pinned where
      it sits, children stay attached. */
  promoteNode: (id: string) => void
  /** Return a free-placed root to the room grid / a dragged child to its parent's orbit. */
  resetToGrid: (id: string) => void
  toggleLock: (id: string) => void
  /** Cascade delete: the note + descendants, minus locked branches. No-op (toast) when locked. */
  removeNode: (id: string) => void
  /** Promote a machine-suggested connection to human-confirmed (persisted). */
  confirmEdge: (edge: WorldEdge) => void
  /** Remove a confirmed connection. */
  unlinkEdge: (id: string) => void
  /** Wipe localStorage and regenerate the seeded palace. */
  resetDemo: () => void

  setEditing: (id: string | null) => void
  toast: (text: string) => void
  dismissToast: (id: number) => void
}

let toastSeq = 0

/** Boot: restore the persisted world if present, else the seeded palace. */
function boot(): { world: World; edges: CavinEdge[] } {
  const stored = worldStorage.load()
  if (stored) {
    try {
      return { world: deriveWorld(stored.nodes, undefined, stored.edges), edges: stored.edges }
    } catch {
      // Corrupt shape — fall through to the seeded world.
    }
  }
  return { world: buildInitialWorld(), edges: [] }
}

function nearestRoom(world: World, at: [number, number]) {
  let best = world.rooms[0]
  let bestD = Infinity
  for (const r of world.rooms) {
    const d = Math.hypot(r.centroid[0] - at[0], r.centroid[1] - at[1])
    if (d < bestD) {
      bestD = d
      best = r
    }
  }
  return best
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `node-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export const useWorldStore = create<WorldState>()((set, get) => {
  /** Full mutation: map nodes, re-derive the world, persist (via subscription). */
  const mutate = (fn: (nodes: LaidOutNode[]) => LaidOutNode[]) =>
    set((s) => ({ world: deriveWorld(fn(s.world.nodes), s.world, s.edges) }))

  /** Edge mutation: replace the confirmed list and re-derive the world so
      world.edges (confirmed + suggested) stays in sync. */
  const mutateEdges = (fn: (edges: CavinEdge[]) => CavinEdge[]) =>
    set((s) => {
      const edges = fn(s.edges)
      return { edges, world: deriveWorld(s.world.nodes, s.world, edges) }
    })

  // Frame-coalesced drag: pointermove can exceed 60Hz, but a drag's position
  // update only needs to land once per frame. We buffer the latest target and
  // flush on the next rAF so subscribers (and the 1087-node remap) see at most
  // one world bump per frame.
  let pendingMove: { id: string; pos: [number, number] } | null = null
  let moveRaf = 0
  const flushMove = () => {
    moveRaf = 0
    if (!pendingMove) return
    const { id, pos } = pendingMove
    pendingMove = null
    const s = get()
    const node = s.world.nodeById.get(id)
    if (!node || !node.placed) return
    const delta: [number, number] = [pos[0] - node.position[0], pos[1] - node.position[1]]
    if (delta[0] === 0 && delta[1] === 0) return
    const movable = movableSubtree(s.world, id)
    const patched = s.world.nodes.map((n) => {
      if (n.id === id) return { ...n, position: pos }
      if (movable.has(n.id)) {
        return {
          ...n,
          position: [n.position[0] + delta[0], n.position[1] + delta[1]] as [number, number],
        }
      }
      return n
    })
    set({ world: { ...s.world, nodes: patched, nodeById: new Map(patched.map((n) => [n.id, n])) } })
  }

  const lockedGuard = (node: LaidOutNode | undefined): node is LaidOutNode => {
    if (!node || node.locked) {
      get().toast('Note is locked — unlock it first')
      return false
    }
    return true
  }

  /** Surface a pure-mutation refusal; silent for no-ops (missing/self/noop). */
  const toastMutationError = (err?: TreeMutationError) => {
    if (err === 'locked-node') get().toast('Note is locked — unlock it first')
    else if (err === 'locked-target') get().toast('Target is locked — unlock it first')
    else if (err === 'cycle') get().toast('Can’t nest a note inside its own descendant')
  }

  const initial = boot()

  return {
    world: initial.world,
    edges: initial.edges,
    editingId: null,
    toasts: [],
    requestedSelection: null,

    addNode: (at) => {
      const s = get()
      const room = nearestRoom(s.world, at)
      const id = newId()
      const attrs = knowledgeAdapter.createDefault({ groupPath: [room.wingName, room.name] })
      const node: LaidOutNode = {
        ...attrs,
        // Authoritative cluster identity comes from the room, not the
        // adapter's name-derived provisional ids.
        wingId: room.wingId,
        roomId: room.id,
        id,
        position: at,
        color: room.color,
        hue: room.hue,
        placed: true,
      }
      mutate((nodes) => [...nodes, node])
      set({ requestedSelection: { id }, editingId: id })
      get().toast('Note created')
      return id
    },

    addChild: (parentId) => {
      const parent = get().world.nodeById.get(parentId)
      if (!parent) return ''
      if (parent.locked) {
        get().toast('Note is locked — unlock it first')
        return ''
      }
      const angle = Math.random() * Math.PI * 2
      const radius = LAYOUT.childSpawnRadiusMin + Math.random() * LAYOUT.childSpawnRadiusSpread
      const relOffset: [number, number] = [Math.cos(angle) * radius, Math.sin(angle) * radius]
      const id = newId()
      const attrs = knowledgeAdapter.createDefault({ groupPath: [parent.wingName, parent.roomName], parentId })
      const node: LaidOutNode = {
        ...attrs,
        // Authoritative cluster identity comes from the parent (see addNode).
        wingId: parent.wingId,
        roomId: parent.roomId,
        id,
        parentId,
        position: [parent.position[0] + relOffset[0], parent.position[1] + relOffset[1]],
        relOffset,
        color: parent.color,
        hue: parent.hue,
      }
      mutate((nodes) => [...nodes, node])
      // Selecting the new child flies the camera to it; Board zooms to reveal
      // its depth automatically (zoom = hierarchy, no expand flags).
      set({ requestedSelection: { id }, editingId: id })
      get().toast('Child note created')
      return id
    },

    updateNode: (id, patch) => {
      const node = get().world.nodeById.get(id)
      if (!node || !lockedGuard(node)) return
      mutate((nodes) =>
        nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                title: (patch.title ?? n.title).trim() || 'Untitled note',
                body: patch.body ?? n.body,
                tags: patch.tags ?? n.tags,
              }
            : n,
        ),
      )
      get().toast('Saved')
    },

    moveNode: (id, pos) => {
      const s = get()
      const node = s.world.nodeById.get(id)
      if (!node || node.locked) return // drag guard stays silent; the layer toasts once
      if (!node.placed) {
        // First move detaches the node from its orbit/cluster — full re-derive.
        const delta: [number, number] = [pos[0] - node.position[0], pos[1] - node.position[1]]
        if (delta[0] === 0 && delta[1] === 0) return
        const movable = movableSubtree(s.world, id)
        mutate((nodes) =>
          nodes.map((n) => {
            if (n.id === id) return { ...n, position: pos, placed: true }
            if (movable.has(n.id)) {
              return {
                ...n,
                position: [n.position[0] + delta[0], n.position[1] + delta[1]] as [number, number],
              }
            }
            return n
          }),
        )
        return
      }
      // Already free-placed: buffer and flush once per frame.
      pendingMove = { id, pos }
      if (!moveRaf) moveRaf = requestAnimationFrame(flushMove)
    },

    reparentNode: (id, newParentId) => {
      const s = get()
      const res = reparentNodes(s.world.nodes, id, newParentId)
      if (!res.ok) {
        toastMutationError(res.error)
        return
      }
      mutate(() => res.nodes!)
      if (res.kind === 'rejoined') {
        get().toast('Back in orbit')
      } else {
        const parent = s.world.nodeById.get(newParentId)
        get().toast(`Moved under “${parent?.title ?? 'note'}”`)
      }
    },

    promoteNode: (id) => {
      const s = get()
      const res = promoteToRootNodes(s.world.nodes, id)
      if (!res.ok) {
        toastMutationError(res.error)
        return
      }
      mutate(() => res.nodes!)
      get().toast('Promoted to a root note')
    },

    resetToGrid: (id) => {
      const node = get().world.nodeById.get(id)
      if (!node || !lockedGuard(node) || !node.placed) return
      mutate((nodes) => nodes.map((n) => (n.id === id ? { ...n, placed: false } : n)))
      get().toast(node.parentId ? 'Back in orbit' : 'Back in the grid')
    },

    toggleLock: (id) => {
      const node = get().world.nodeById.get(id)
      if (!node) return
      const locking = !node.locked
      // Locking IS confirming: the flag marks human-reviewed notes so future
      // machine imports leave them alone.
      mutate((nodes) =>
        nodes.map((n) => (n.id === id ? { ...n, locked: locking, confirmed: locking } : n)),
      )
      if (!locking && get().editingId === id) set({ editingId: null })
      get().toast(locking ? 'Note locked & confirmed' : 'Note unlocked')
    },

    removeNode: (id) => {
      const node = get().world.nodeById.get(id)
      if (!node || !lockedGuard(node)) return
      const doomed = deletableSubtree(get().world, id)
      // Connections are weak references: prune confirmed edges touching the
      // deleted subtree (suggested ones are re-derived anyway).
      if (get().edges.some((e) => doomed.has(e.from) || doomed.has(e.to))) {
        mutateEdges((edges) => edges.filter((e) => !doomed.has(e.from) && !doomed.has(e.to)))
      }
      mutate((nodes) => nodes.filter((n) => !doomed.has(n.id)))
      // Selection cleanup happens in the App bridge: the deleted ids are no
      // longer in the world, so a stale selectedId is cleared there.
      set((s) => ({ editingId: s.editingId && doomed.has(s.editingId) ? null : s.editingId }))
      get().toast(doomed.size > 1 ? `Deleted ${doomed.size} notes` : 'Note deleted')
    },

    confirmEdge: (edge) => {
      const { from, to } = edge
      if (!get().world.nodeById.has(from) || !get().world.nodeById.has(to)) return
      // Confirming preserves the suggested edge's pair identity, so the
      // confirmed edge shadows the suggestion in world.edges.
      mutateEdges((edges) =>
        edges.some((e) => e.id === edge.id)
          ? edges
          : [...edges, { id: edge.id, from, to, createdAt: Date.now() }],
      )
      get().toast('Connection confirmed')
    },

    unlinkEdge: (id) => {
      mutateEdges((edges) => edges.filter((e) => e.id !== id))
      get().toast('Connection removed')
    },

    resetDemo: () => {
      worldStorage.clear()
      set({ world: buildInitialWorld(), edges: [], editingId: null })
      get().toast('Demo data restored')
    },

    setEditing: (id) => set({ editingId: id }),

    toast: (text) => set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, text }] })),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  }
})

// Persist the node array + confirmed edges (debounced) whenever they change.
// A failed save surfaces as a one-shot toast so the user knows persistence
// stopped.
let saveTimer: number | undefined
let lastSaveWarned = false
useWorldStore.subscribe((s, prev) => {
  if (s.world === prev.world && s.edges === prev.edges) return
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const state = useWorldStore.getState()
    const ok = worldStorage.save(state.world.nodes, state.edges)
    if (!ok && !lastSaveWarned) {
      lastSaveWarned = true
      useWorldStore.getState().toast('Storage full — changes won’t persist')
    } else if (ok) {
      lastSaveWarned = false
    }
  }, 300)
})
