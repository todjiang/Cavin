/**
 * Core schema abstraction. This is the only interface a host must implement
 * to plug arbitrary data into Cavin; the UI and layout engine never read
 * schema fields by name.
 */
export interface FieldDescriptor {
  key: string
  label: string
  kind: 'text' | 'multiline' | 'tags' | 'number' | 'readonly'
  placeholder?: string
}

export interface SchemaAdapter<TAttr = unknown> {
  /** Human name for an item — drives all user-facing copy. */
  noun: string

  /** Cluster path for a node, coarse → fine. Empty = ungrouped/free space. */
  groupOf(node: { attributes: TAttr; parentId?: string }): string[]

  /** One-line label for chips, minimap, breadcrumb, toasts, search hits. */
  labelOf(node: { attributes: TAttr }): string

  /** Optional longer text for search indexing; default searches labelOf. */
  searchTextOf?(node: { attributes: TAttr }): string

  /** Optional color for a group path; default rotates hues over top-level groups. */
  colorOf?(groupPath: string[]): string

  /** Field descriptors driving the detail panel and validation. */
  fields: FieldDescriptor[]

  /** Decode/validate a persisted record. Returns null to drop malformed data. */
  validate(raw: unknown): CavinNode<TAttr> | null

  /** Create default attributes for a new node in the given context. */
  createDefault(ctx: { groupPath: string[]; parentId?: string }): TAttr

  /** Optional layout vector for similarity-based initial scatter. */
  layoutVectorOf?(node: { attributes: TAttr }): number[] | undefined
}

export interface NodeState {
  /** Cannot be moved, edited, or deleted until unlocked. */
  locked?: boolean
  /** Human-confirmed: future machine imports must not overwrite. */
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
  /** Cluster path, coarse → fine. */
  groupPath: string[]
  /** Host-defined payload. */
  attributes: TAttr
  /** Framework-level node state. */
  state: NodeState
}
