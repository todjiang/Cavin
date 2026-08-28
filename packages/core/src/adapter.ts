import type { CavinNode } from './types'

/**
 * The plug point. One object per host dataset — the only code an integrator
 * must write. The core and the React canvas never read schema fields by
 * name; every field access goes through this interface.
 */
export interface FieldDescriptor<TAttr = unknown> {
  /** Key into TAttr. */
  key: keyof TAttr & string
  label: string
  kind: 'text' | 'multiline' | 'tags' | 'number' | 'readonly'
  /** Placeholder / empty-state copy for the editor. */
  placeholder?: string
  /** Flags the (numeric) field that drives the time-dimension slider.
      Exactly one field should carry it; the slider renders only when set. */
  time?: boolean
}

export interface SchemaAdapter<TAttr = unknown> {
  /** Human name for an item ("note", "task", "organism") — drives all copy. */
  noun: string

  /** Cluster path for a node, coarse → fine. Called for nodes that arrive
      without a denormalized `groupPath` (fresh imports); length may vary per
      node; an empty array means "ungrouped" (renders as free space). */
  groupOf(node: CavinNode<TAttr>): string[]

  /** One-line label for chips, minimap, breadcrumb, toasts, search hits. */
  labelOf(node: CavinNode<TAttr>): string

  /** Optional longer text for search indexing; default searches labelOf. */
  searchTextOf?(node: CavinNode<TAttr>): string

  /** Optional color for a group path; default = deterministic hue rotation
      over the top-level group (first-encounter order). Any CSS color works;
      an `hsl(H, S%, L%)` form also feeds the alpha-channel (hue) variants. */
  colorOf?(groupPath: string[]): string

  /** Field descriptors driving the detail panel, search, and validation. */
  fields: FieldDescriptor<TAttr>[]

  /** Decode/validate a persisted record. Returns null to drop malformed
      data — never throws. Also the migration seam: hosts accepting a legacy
      persisted shape decode it here into a CavinNode. */
  validate(raw: unknown): CavinNode<TAttr> | null

  /** Attributes for a newly created node in the given group context. */
  createDefault(ctx: { groupPath: string[]; parentId?: string }): TAttr

  /** Optional initial-layout hint, e.g. an embedding vector. When present,
      the scatter layout uses it for similarity-scaled spread; when absent,
      layout is pure deterministic jitter. */
  layoutVectorOf?(node: CavinNode<TAttr>): number[] | undefined
}
