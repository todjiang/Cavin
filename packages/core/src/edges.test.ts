import { describe, expect, it } from 'vitest'
import type { CavinEdge } from './edges'
import { edgePairKey, mergeEdges, suggestEdges } from './edges'

/**
 * Pure edge-layer tests: machine suggestion rules (cross-domain only,
 * thresholded, per-node cap, deterministic) and the confirmed/suggested
 * merge contract (weak references, confirmed shadows suggested).
 */

interface TN {
  id: string
  domain: string
  vec: number[]
}

const n = (id: string, domain: string, vec: number[]): TN => ({ id, domain, vec })
const domainOf = (t: TN) => t.domain
const vectorOf = (t: TN) => t.vec
const cfg = { simThreshold: 0.5, maxPerNode: 1 }

const pairOf = (edges: CavinEdge[]) => edges.map((e) => edgePairKey(e.from, e.to))

describe('suggestEdges', () => {
  it('never links nodes in the same domain, however similar', () => {
    const edges = suggestEdges([n('a', 'X', [1, 0]), n('b', 'X', [1, 0])], domainOf, vectorOf, cfg)
    expect(edges).toEqual([])
  })

  it('links similar cross-domain pairs, thresholded by cosine similarity', () => {
    const edges = suggestEdges(
      [
        n('a', 'X', [1, 0]),
        n('b', 'Y', [0.9, 0.1]), // sim ≈ 0.99 → kept
        n('c', 'Y', [0, 1]), // sim 0 → dropped
      ],
      domainOf,
      vectorOf,
      cfg,
    )
    expect(pairOf(edges)).toEqual([edgePairKey('a', 'b')])
  })

  it('is deterministic: same input, same ids and order', () => {
    const nodes = [
      n('a', 'X', [1, 0.2]),
      n('b', 'Y', [1, 0.1]),
      n('c', 'Z', [0.9, 0.3]),
      n('d', 'Y', [0.8, 0.4]),
    ]
    const run1 = suggestEdges(nodes, domainOf, vectorOf, cfg)
    const run2 = suggestEdges(nodes, domainOf, vectorOf, cfg)
    expect(run1).toEqual(run2)
    expect(run1.length).toBeGreaterThan(0)
  })

  it('caps each node at maxPerNode unless a partner still ranks it top-K', () => {
    // a's candidates: b (0.99) and c (0.98) — capped to b. But c prefers d
    // (sim 1.0) over a, and d prefers c — so a–c survives from nobody's
    // top-1 and is dropped, while c–d is kept.
    const edges = suggestEdges(
      [
        n('a', 'X', [1, 0.01]),
        n('b', 'Y', [1, 0]),
        n('c', 'Y', [0.9, 0.44]),
        n('d', 'Z', [0.9, 0.44]),
      ],
      domainOf,
      vectorOf,
      cfg,
    )
    const pairs = pairOf(edges)
    expect(pairs).toContain(edgePairKey('a', 'b'))
    expect(pairs).toContain(edgePairKey('c', 'd'))
    expect(pairs).not.toContain(edgePairKey('a', 'c'))
  })

  it('skips nodes without a vector', () => {
    const edges = suggestEdges(
      [n('a', 'X', [1, 0]), { id: 'b', domain: 'Y', vec: [] }],
      domainOf,
      (t) => (t.vec.length ? t.vec : undefined),
      cfg,
    )
    expect(edges).toEqual([])
  })
})

describe('mergeEdges', () => {
  const ids = new Set(['a', 'b', 'c'])

  it('drops dangling references and self-loops', () => {
    const edges = mergeEdges(
      [
        { id: 'e1', from: 'a', to: 'ghost', createdAt: 1 },
        { id: 'e2', from: 'a', to: 'a', createdAt: 1 },
        { id: 'e3', from: 'a', to: 'b', createdAt: 1 },
      ],
      [{ id: 'sugg:b c', from: 'b', to: 'ghost', createdAt: 0 }],
      ids,
    )
    expect(edges.map((e) => e.id)).toEqual(['e3'])
    expect(edges[0].kind).toBe('confirmed')
  })

  it('a confirmed edge shadows the suggestion for the same pair', () => {
    const edges = mergeEdges(
      [{ id: 'mine', from: 'b', to: 'a', createdAt: 1 }],
      [
        { id: 'sugg:a b', from: 'a', to: 'b', createdAt: 0 },
        { id: 'sugg:b c', from: 'b', to: 'c', createdAt: 0 },
      ],
      ids,
    )
    expect(edges.map((e) => [e.id, e.kind])).toEqual([
      ['mine', 'confirmed'],
      ['sugg:b c', 'suggested'],
    ])
  })
})

describe('suggestEdges — degenerate vectors', () => {
  it('a node with an all-zero layout vector never attracts suggestions', () => {
    const edges = suggestEdges(
      [n('new', 'X', [0, 0, 0]), n('a', 'Y', [1, 0]), n('b', 'Z', [1, 0.02])],
      domainOf,
      vectorOf,
      { simThreshold: 0.5, maxPerNode: 3 },
    )
    // a–b suggest; the zero-vector node appears in no edge, as either endpoint.
    expect(edges.every((e) => e.from !== 'new' && e.to !== 'new')).toBe(true)
    expect(edges).toHaveLength(1)
  })
})
