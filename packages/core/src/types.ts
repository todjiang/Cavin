import type { WorldEdge } from './edges'

/**
 * The framework's data model — everything downstream (derive, commands, LOD,
 * renderers) sees. `TAttr` is the host's attribute payload; nothing in the
 * core knows what a "note", "wing", or "room" is.
 */

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

export interface CavinNode<TAttr = unknown> {
  id: string
  /** Absent = root of a group; set = child of another node (room semantics). */
  parentId?: string
  /** 2D world position (world units = px at zoom 1). */
  position: [number, number]
  /** Cluster path, coarse → fine. Denormalized onto the node so mutations
      (re-parent) can move a whole subtree between clusters; `adapter.groupOf`
      fills it for nodes that arrive without one, and hosts may derive it
      from attributes there. Empty array = ungrouped (renders as free space). */
  groupPath: string[]
  /** Host-defined payload — title/body/tags/embedding in the demo. */
  attributes: TAttr
  /** Framework-level node state (locks, placement, orbit offsets). */
  state: NodeState
}

/**
 * A cluster of nodes at any grouping depth, aggregated from `groupPath`.
 * Leaf clusters (deepest segment of a node's path) aggregate their member
 * ROOTS; interior clusters aggregate their direct sub-clusters. `id` = path
 * joined with PATH_SEP, so a depth-0 group's id is simply its top segment.
 */
export interface GroupCluster {
  id: string
  /** The path prefix this cluster represents, e.g. ["Design"]. */
  path: string[]
  /** Display name = last segment; breadcrumb = the whole path. */
  name: string
  /** 0 = top level, 1 = next level, … */
  depth: number
  centroid: [number, number]
  radius: number
  count: number
  /** Presentation color: `adapter.colorOf(path)` or the default hue rotation. */
  color: string
  /** Hue parsed from `color` when possible — canvas gradients need an alpha
      channel (hsla); hosts with unparseable colors get the default hue. */
  hue: number
}

export interface Camera {
  /** World coords at the viewport center. */
  x: number
  y: number
  /** Scale: screen px per world unit. */
  zoom: number
}

export interface World<TAttr = unknown> {
  nodes: CavinNode<TAttr>[]
  /** All clusters at all depths, sorted coarse → fine (first-encounter order
      within a depth — stable paint order). Renderers slice by `depth`. */
  groups: GroupCluster[]
  nodeById: Map<string, CavinNode<TAttr>>
  /** Group path key (path joined with PATH_SEP) → cluster. */
  groupByPath: Map<string, GroupCluster>
  /** Parent id → its children, in node-array order (creation order for
      generated data). Key present only for parents. */
  childrenByParent: Map<string, CavinNode<TAttr>[]>
  /** Nesting depth: 0 = group-level root, 1 = child, 2 = grandchild, … */
  depthById: Map<string, number>
  /** Cross-domain connections: confirmed (persisted) + suggested (derived). */
  edges: WorldEdge[]
  /** Node id → edges touching it. */
  edgesByNode: Map<string, WorldEdge[]>
  /** Node id → number of connections (importance signal: hubs surface first). */
  degreeById: Map<string, number>
  /** Max value in degreeById (0 when the world has no edges) — for normalization. */
  maxDegree: number
}

/**
 * The selection spotlight set: the selected node, the other ends of its
 * confirmed edges, plus its tree context (children and the ancestor chain —
 * a node's place stays visible while its relations light up).
 * Returns null when there is no selection or the node has no confirmed
 * edges; callers fall back to the plain (non-isolating) spotlight then.
 */
export interface SelectionFocus {
  id: string
  nodeIds: Set<string>
  edgeIds: Set<string>
  /** Confirmed neighbors only — the nodes that gather onto the
      constellation ring. Ancestors stay home. */
  ringIds: Set<string>
  /** Direct unplaced children (excluding any that are also confirmed
      neighbors) — they gather on the inner ring, array order first. */
  childIds: string[]
}

export type TreeMutationError =
  | 'missing'
  | 'self'
  | 'cycle'
  | 'noop'
  | 'locked-node'
  | 'locked-target'

export interface TreeMutationOutcome<TAttr = unknown> {
  ok: boolean
  error?: TreeMutationError
  nodes?: CavinNode<TAttr>[]
  /** 'rejoined' = dropped back on the current parent and returned to orbit. */
  kind?: 'reparented' | 'rejoined' | 'promoted'
}
