import { layoutConfig } from './config'
import type { LayoutConfig } from './config'
import type { SchemaAdapter } from './adapter'
import type { CavinNode, GroupCluster, TreeMutationError, World } from './types'
import type { CavinEdge } from './edges'
import {
  deletableSubtree,
  deriveWorld,
  movableSubtree,
  promoteToRootNodes,
  reparentNodes,
} from './layout'

/**
 * The command layer: every structural edit is one serializable command
 * dispatched through `applyCommand` — the single funnel where the mutation
 * semantics (lock shielding, cycle guards, orbit re-join) live. This is the
 * seam for undo/redo, edit history, and (later) CRDT sync: the UI issues
 * exactly the commands a headless script would.
 *
 * The core never prints strings: refusals come back as `error`, successes
 * as presentation-neutral `notice` kinds that the UI maps to toasts.
 */

export type Command<TAttr = unknown> =
  /** Create a root at a world position, in the nearest deepest group. */
  | { type: 'add'; at: [number, number] }
  /** Create an unplaced child of the given node. */
  | { type: 'addChild'; parentId: string }
  /** Merge a patch into the node's attributes (adapter field keys). */
  | { type: 'update'; id: string; patch: Partial<TAttr> }
  /** Move + free-place a node; the movable subtree follows. */
  | { type: 'move'; id: string; to: [number, number] }
  | { type: 'reparent'; id: string; newParentId: string }
  | { type: 'promote'; id: string }
  /** Return a free-placed root to its cluster grid / a dragged child to orbit. */
  | { type: 'resetPlacement'; id: string }
  /** Locking IS confirming: sets `locked` and `confirmed` together. */
  | { type: 'setLocked'; id: string; locked: boolean }
  /** Cascade delete: node + descendants, minus locked branches. */
  | { type: 'remove'; id: string }
  | { type: 'confirmEdge'; edge: CavinEdge }
  | { type: 'removeEdge'; id: string }

export interface MutationNotice {
  kind:
    | 'created'
    | 'child-created'
    | 'saved'
    | 'rejoined'
    | 'reparented'
    | 'promoted'
    | 'reset-orbit'
    | 'reset-root'
    | 'locked'
    | 'unlocked'
    | 'deleted'
    | 'edge-confirmed'
    | 'edge-removed'
  count?: number
  /** For reparented: the new parent. */
  targetId?: string
}

export interface MutationResult<TAttr = unknown> {
  ok: boolean
  error?: TreeMutationError
  /** The derived world after the command. Absent only for silent no-ops. */
  world?: World<TAttr>
  /** Updated confirmed-edge list — only when the command changed it. */
  edges?: CavinEdge[]
  notice?: MutationNotice
  /** For add / addChild: the id of the created node (selection + editor). */
  createdId?: string
}

let idSeq = 0
/** Framework-generated node ids. Hosts may bring their own on import. */
export function newId(): string {
  idSeq = (idSeq + 1) % Number.MAX_SAFE_INTEGER
  return `n-${Date.now().toString(36)}-${idSeq.toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

/** Nearest cluster at the deepest grouping level present — where a new root
    lands. `null` when the world has no groups (ungrouped data). */
function nearestLeafGroup<TAttr>(
  world: World<TAttr>,
  at: [number, number],
): GroupCluster | null {
  let maxDepth = -1
  for (const g of world.groups) if (g.depth > maxDepth) maxDepth = g.depth
  if (maxDepth < 0) return null
  let best: GroupCluster | null = null
  let bestD = Infinity
  for (const g of world.groups) {
    if (g.depth !== maxDepth) continue
    const d = Math.hypot(g.centroid[0] - at[0], g.centroid[1] - at[1])
    if (d < bestD) {
      bestD = d
      best = g
    }
  }
  return best
}

function node<TAttr>(world: World<TAttr>, id: string): CavinNode<TAttr> | undefined {
  return world.nodeById.get(id)
}

/**
 * Frame-coalesced drag: pointermove can exceed 60Hz, but a drag's position
 * update only needs to land once per frame. Buffers the latest target into
 * a positional patch of the movable subtree — no re-derive. Returns null
 * when there is nothing to do (unknown/unplaced node, zero delta).
 */
export function applyDragFrame<TAttr>(
  world: World<TAttr>,
  id: string,
  pos: [number, number],
): World<TAttr> | null {
  const n = node(world, id)
  if (!n || !n.state.placed) return null
  const delta: [number, number] = [pos[0] - n.position[0], pos[1] - n.position[1]]
  if (delta[0] === 0 && delta[1] === 0) return null
  const movable = movableSubtree(world, id)
  const patched = world.nodes.map((m) => {
    if (m.id === id) return { ...m, position: pos }
    if (movable.has(m.id)) {
      return {
        ...m,
        position: [m.position[0] + delta[0], m.position[1] + delta[1]] as [number, number],
      }
    }
    return m
  })
  return {
    ...world,
    nodes: patched,
    nodeById: new Map(patched.map((m) => [m.id, m])),
  }
}

export function applyCommand<TAttr>(
  world: World<TAttr>,
  cmd: Command<TAttr>,
  adapter: SchemaAdapter<TAttr>,
  config: LayoutConfig = layoutConfig,
  rand: () => number = Math.random,
): MutationResult<TAttr> {
  // Re-derive with the world's own confirmed edges (world.edges also carries
  // suggestions, which deriveWorld recomputes).
  const confirmed = world.edges.filter((e) => e.kind === 'confirmed')
  const derive = (nodes: CavinNode<TAttr>[]): World<TAttr> =>
    deriveWorld(nodes, adapter, world, confirmed, config)

  switch (cmd.type) {
    case 'add': {
      const group = nearestLeafGroup(world, cmd.at)
      const groupPath = group ? [...group.path] : []
      const id = newId()
      const created: CavinNode<TAttr> = {
        id,
        position: [...cmd.at] as [number, number],
        groupPath,
        attributes: adapter.createDefault({ groupPath }),
        state: { placed: true },
      }
      return {
        ok: true,
        world: derive([...world.nodes, created]),
        createdId: id,
        notice: { kind: 'created' },
      }
    }

    case 'addChild': {
      const parent = node(world, cmd.parentId)
      if (!parent) return { ok: false, error: 'missing' }
      if (parent.state.locked) return { ok: false, error: 'locked-node' }
      const angle = rand() * Math.PI * 2
      const radius =
        config.layout.childSpawnRadiusMin + rand() * config.layout.childSpawnRadiusSpread
      const relOffset: [number, number] = [Math.cos(angle) * radius, Math.sin(angle) * radius]
      const id = newId()
      const created: CavinNode<TAttr> = {
        id,
        parentId: parent.id,
        position: [parent.position[0] + relOffset[0], parent.position[1] + relOffset[1]],
        groupPath: [...parent.groupPath],
        attributes: adapter.createDefault({ groupPath: parent.groupPath, parentId: parent.id }),
        state: { relOffset },
      }
      return {
        ok: true,
        world: derive([...world.nodes, created]),
        createdId: id,
        notice: { kind: 'child-created' },
      }
    }

    case 'update': {
      const n = node(world, cmd.id)
      if (!n) return { ok: false, error: 'missing' }
      if (n.state.locked) return { ok: false, error: 'locked-node' }
      return {
        ok: true,
        world: derive(
          world.nodes.map((m) =>
            m.id === cmd.id ? { ...m, attributes: { ...m.attributes, ...cmd.patch } } : m,
          ),
        ),
        notice: { kind: 'saved' },
      }
    }

    case 'move': {
      const n = node(world, cmd.id)
      if (!n || n.state.locked) return { ok: false, error: 'locked-node' }
      if (!n.state.placed) {
        // First move detaches the node from its orbit/cluster — full re-derive.
        const delta: [number, number] = [cmd.to[0] - n.position[0], cmd.to[1] - n.position[1]]
        if (delta[0] === 0 && delta[1] === 0) return { ok: true }
        const movable = movableSubtree(world, cmd.id)
        return {
          ok: true,
          world: derive(
            world.nodes.map((m) => {
              if (m.id === cmd.id) {
                return { ...m, position: cmd.to, state: { ...m.state, placed: true } }
              }
              if (movable.has(m.id)) {
                return {
                  ...m,
                  position: [m.position[0] + delta[0], m.position[1] + delta[1]] as [number, number],
                }
              }
              return m
            }),
          ),
        }
      }
      const framed = applyDragFrame(world, cmd.id, cmd.to)
      return framed ? { ok: true, world: framed } : { ok: true }
    }

    case 'reparent': {
      const res = reparentNodes(world.nodes, cmd.id, cmd.newParentId, rand, config)
      if (!res.ok || !res.nodes) return { ok: false, error: res.error }
      return {
        ok: true,
        world: derive(res.nodes),
        notice:
          res.kind === 'rejoined'
            ? { kind: 'rejoined' }
            : { kind: 'reparented', targetId: cmd.newParentId },
      }
    }

    case 'promote': {
      const res = promoteToRootNodes(world.nodes, cmd.id)
      if (!res.ok || !res.nodes) return { ok: false, error: res.error }
      return { ok: true, world: derive(res.nodes), notice: { kind: 'promoted' } }
    }

    case 'resetPlacement': {
      const n = node(world, cmd.id)
      if (!n) return { ok: false, error: 'missing' }
      if (n.state.locked) return { ok: false, error: 'locked-node' }
      if (!n.state.placed) return { ok: false, error: 'noop' }
      return {
        ok: true,
        world: derive(
          world.nodes.map((m) =>
            m.id === cmd.id ? { ...m, state: { ...m.state, placed: false } } : m,
          ),
        ),
        notice: { kind: n.parentId ? 'reset-orbit' : 'reset-root' },
      }
    }

    case 'setLocked': {
      const n = node(world, cmd.id)
      if (!n) return { ok: false, error: 'missing' }
      return {
        ok: true,
        world: derive(
          world.nodes.map((m) =>
            m.id === cmd.id
              ? { ...m, state: { ...m.state, locked: cmd.locked, confirmed: cmd.locked } }
              : m,
          ),
        ),
        notice: { kind: cmd.locked ? 'locked' : 'unlocked' },
      }
    }

    case 'remove': {
      const n = node(world, cmd.id)
      if (!n) return { ok: false, error: 'missing' }
      if (n.state.locked) return { ok: false, error: 'locked-node' }
      const doomed = deletableSubtree(world, cmd.id)
      // Connections are weak references: prune confirmed edges touching the
      // deleted subtree (suggested ones are re-derived anyway).
      const edges = confirmed.filter((e) => !doomed.has(e.from) && !doomed.has(e.to))
      return {
        ok: true,
        world: deriveWorld(
          world.nodes.filter((m) => !doomed.has(m.id)),
          adapter,
          world,
          edges,
          config,
        ),
        edges: edges.length === confirmed.length ? undefined : edges,
        notice: { kind: 'deleted', count: doomed.size },
      }
    }

    case 'confirmEdge': {
      const { from, to } = cmd.edge
      if (!world.nodeById.has(from) || !world.nodeById.has(to)) return { ok: false, error: 'missing' }
      // Confirming preserves the suggested edge's pair identity, so the
      // confirmed edge shadows the suggestion in world.edges.
      if (confirmed.some((e) => e.id === cmd.edge.id)) return { ok: true }
      const edges: CavinEdge[] = [
        ...confirmed,
        { id: cmd.edge.id, from, to, createdAt: cmd.edge.createdAt, label: cmd.edge.label },
      ]
      return {
        ok: true,
        world: deriveWorld(world.nodes, adapter, world, edges, config),
        edges,
        notice: { kind: 'edge-confirmed' },
      }
    }

    case 'removeEdge': {
      const edges = confirmed.filter((e) => e.id !== cmd.id)
      if (edges.length === confirmed.length) return { ok: true }
      return {
        ok: true,
        world: deriveWorld(world.nodes, adapter, world, edges, config),
        edges,
        notice: { kind: 'edge-removed' },
      }
    }
  }
}
