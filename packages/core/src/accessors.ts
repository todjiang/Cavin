import type { FieldDescriptor, SchemaAdapter } from './adapter'
import type { CavinNode } from './types'

/**
 * Schema-agnostic field access: every consumer of item content (detail
 * panel, chips, search, toasts) goes through these — never schema fields
 * by name.
 */

export function labelOf<TAttr>(adapter: SchemaAdapter<TAttr>, node: CavinNode<TAttr>): string {
  return adapter.labelOf(node)
}

export function searchTextOf<TAttr>(
  adapter: SchemaAdapter<TAttr>,
  node: CavinNode<TAttr>,
): string {
  return adapter.searchTextOf?.(node) ?? labelOf(adapter, node)
}

/** Raw value of one declared field on a node (undefined when unset). This is
    the single sanctioned way to read `attributes` outside the adapter — UI
    code should go through this or a semantic accessor, never index
    `attributes` by key directly. */
export function fieldValueOf<TAttr>(
  node: CavinNode<TAttr>,
  field: FieldDescriptor<TAttr>,
): unknown {
  return (node.attributes as Record<string, unknown>)[field.key]
}

/** Values of every `tags`-kind field, concatenated. */
export function tagsOf<TAttr>(adapter: SchemaAdapter<TAttr>, node: CavinNode<TAttr>): string[] {
  return adapter.fields
    .filter((f) => f.kind === 'tags')
    .flatMap((f) => {
      const v = fieldValueOf(node, f)
      return Array.isArray(v) ? (v as string[]) : []
    })
}

/** Value of the first `multiline`-kind field (the long-form content). */
export function bodyOf<TAttr>(adapter: SchemaAdapter<TAttr>, node: CavinNode<TAttr>): string {
  const f = adapter.fields.find((d) => d.kind === 'multiline')
  const v = f ? fieldValueOf(node, f) : undefined
  return typeof v === 'string' ? v : ''
}

/** The field flagged as the time axis, if the adapter declares one. */
export function timeFieldOf<TAttr>(
  adapter: SchemaAdapter<TAttr>,
): FieldDescriptor<TAttr> | undefined {
  return adapter.fields.find((f) => f.time === true)
}

/** The node's position on the time axis (undefined when the host has none). */
export function timeOf<TAttr>(adapter: SchemaAdapter<TAttr>, node: CavinNode<TAttr>): number | undefined {
  const f = timeFieldOf(adapter)
  const v = f ? fieldValueOf(node, f) : undefined
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** The data-derived [min, max] domain of the time axis; null when no node
    carries a finite time value. */
export function timeRangeOf<TAttr>(
  nodes: CavinNode<TAttr>[],
  adapter: SchemaAdapter<TAttr>,
): [number, number] | null {
  let min = Infinity
  let max = -Infinity
  for (const n of nodes) {
    const t = timeOf(adapter, n)
    if (t === undefined) continue
    if (t < min) min = t
    if (t > max) max = t
  }
  return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null
}
