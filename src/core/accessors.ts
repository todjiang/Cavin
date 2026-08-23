import type { SchemaAdapter } from './schema'

/**
 * Transitional accessors bridging the legacy flat LaidOutNode to the
 * SchemaAdapter contract: until nodes become CavinNode in P3, a node's
 * attributes ARE the node itself, so these helpers pass it to the adapter as
 * `{ attributes: n }` and read field-descriptor keys off the top level.
 *
 * UI/board code must read item content through these (or `groupPath`, which
 * is framework-level) — never schema fields by name. The adapter import
 * itself stays at the call site for now; P4 injects it via context.
 */

export function labelOf<TAttr>(adapter: SchemaAdapter<TAttr>, node: unknown): string {
  return adapter.labelOf({ attributes: node as TAttr })
}

export function searchTextOf<TAttr>(adapter: SchemaAdapter<TAttr>, node: unknown): string {
  return adapter.searchTextOf?.({ attributes: node as TAttr }) ?? labelOf(adapter, node)
}

/** Values of every `tags`-kind field, concatenated. */
export function tagsOf<TAttr>(adapter: SchemaAdapter<TAttr>, node: unknown): string[] {
  const rec = node as Record<string, unknown>
  return adapter.fields
    .filter((f) => f.kind === 'tags')
    .flatMap((f) => (Array.isArray(rec[f.key]) ? (rec[f.key] as string[]) : []))
}

/** Value of the first `multiline`-kind field (the long-form content). */
export function bodyOf<TAttr>(adapter: SchemaAdapter<TAttr>, node: unknown): string {
  const rec = node as Record<string, unknown>
  const f = adapter.fields.find((d) => d.kind === 'multiline')
  const v = f ? rec[f.key] : undefined
  return typeof v === 'string' ? v : ''
}
