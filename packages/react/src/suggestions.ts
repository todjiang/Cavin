import type { CavinEdge, CavinNode, SchemaAdapter } from '@cavin/core'
import { suggestEdges } from '@cavin/core'

/**
 * Call-site owner of the machine-suggestion list.
 *
 * `suggestEdges` is an O(n²) cosine sweep whose inputs are exactly two
 * things per node: its top-level group and its layout vector. Everything
 * else that re-derives the world (attribute edits, locks, placement, drags)
 * cannot change the result — so recomputing on every derive is wasted work
 * the size of the dataset squared.
 *
 * This cache fingerprints precisely those inputs (O(n)) and recomputes only
 * when the fingerprint changes. `suggest()` returns the SAME array identity
 * when nothing changed, so callers can identity-compare to skip a re-derive.
 */
export function createSuggestionCache<TAttr>(adapter: SchemaAdapter<TAttr>) {
  let sig = ''
  let cached: CavinEdge[] = []
  return {
    /** Current suggestion list, recomputed only when inputs changed. */
    suggest(nodes: CavinNode<TAttr>[]): CavinEdge[] {
      const parts: string[] = new Array(nodes.length)
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const vec = adapter.layoutVectorOf?.(n)
        parts[i] = `${n.id}\u0000${n.groupPath[0] ?? ''}\u0000${vec ? vec.join(',') : ''}`
      }
      const next = parts.join('\n')
      if (next !== sig) {
        sig = next
        cached = suggestEdges(
          nodes,
          (n) => n.groupPath[0] ?? '',
          (n) => adapter.layoutVectorOf?.(n),
        )
      }
      return cached
    },
  }
}

export type SuggestionCache<TAttr = unknown> = ReturnType<typeof createSuggestionCache<TAttr>>
