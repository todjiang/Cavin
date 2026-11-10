import { describe, expect, it, vi } from 'vitest'
import type { CavinNode } from '@cavin/core'
import { suggestEdges } from '@cavin/core'
import { createSuggestionCache } from './suggestions'

/**
 * The suggestion cache is the call-site owner of the machine-suggestion
 * list: it recomputes the O(n²) cosine sweep only when the inputs
 * suggestEdges reads — node id, top-level group, layout vector — change,
 * and returns the SAME array identity when they don't.
 */

vi.mock('@cavin/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@cavin/core')>()
  return { ...original, suggestEdges: vi.fn(original.suggestEdges) }
})

interface Attrs {
  title: string
  embedding: number[]
}

const adapter = {
  noun: 'item',
  labelOf: (n: CavinNode<Attrs>) => n.attributes.title,
  fields: [{ key: 'title' as const, label: 'Title', kind: 'text' as const }],
  validate: () => null,
  createDefault: (): Attrs => ({ title: '', embedding: [] }),
  layoutVectorOf: (n: CavinNode<Attrs>) => n.attributes.embedding,
}

const node = (id: string, top: string, embedding: number[]): CavinNode<Attrs> => ({
  id,
  position: [0, 0],
  groupPath: [top],
  attributes: { title: id, embedding },
  state: {},
})

describe('createSuggestionCache', () => {
  it('recomputes when the vector or group changes, reuses otherwise', () => {
    const cache = createSuggestionCache(adapter)
    const nodes = [node('a', 'X', [1, 0]), node('b', 'Y', [1, 0])]
    const first = cache.suggest(nodes)
    expect(first.length).toBe(1)
    expect(suggestEdges).toHaveBeenCalledTimes(1)

    // Same inputs → same array identity, no recompute.
    const moved = nodes.map((n) => ({ ...n, position: [9, 9] as [number, number] }))
    expect(cache.suggest(moved)).toBe(first)
    expect(suggestEdges).toHaveBeenCalledTimes(1)

    // An attribute-only update (title) does not recompute suggestions.
    const renamed = nodes.map((n) => ({ ...n, attributes: { ...n.attributes, title: 'z' } }))
    expect(cache.suggest(renamed)).toBe(first)
    expect(suggestEdges).toHaveBeenCalledTimes(1)

    // A vector change recomputes.
    const reembedded = nodes.map((n) =>
      n.id === 'a' ? { ...n, attributes: { ...n.attributes, embedding: [0, 1] } } : n,
    )
    expect(cache.suggest(reembedded)).not.toBe(first)
    expect(suggestEdges).toHaveBeenCalledTimes(2)

    // A group change recomputes.
    const regrouped = nodes.map((n) => (n.id === 'b' ? { ...n, groupPath: ['X'] } : n))
    expect(cache.suggest(regrouped)).not.toBe(first)
    expect(suggestEdges).toHaveBeenCalledTimes(3)
  })
})
