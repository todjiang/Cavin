import { layoutConfig } from './config'

/**
 * Cross-domain connections — edges between nodes in different top-level
 * groups, living next to (and independent of) the parentId tree.
 *
 * Two sources, mirroring the progressive-editing lifecycle:
 * - **Suggested** (machine draft): recomputed on every derive from the
 *   nodes' layout vectors (embeddings in the demo) — never persisted, so a
 *   re-import or edit changes the suggestions automatically.
 * - **Confirmed** (human): persisted alongside the node array; a confirmed
 *   edge shadows the suggested one for the same pair.
 *
 * Edges are weak references: when either endpoint disappears the edge is
 * dropped at derive time — deletion is never blocked by a connection.
 */

export interface CavinEdge {
  id: string
  from: string
  to: string
  createdAt: number
  /** Optional human-readable label for confirmed relations, e.g. "主公". */
  label?: string
}

export interface WorldEdge extends CavinEdge {
  kind: 'suggested' | 'confirmed'
}

/** Order-independent pair key — suggested and confirmed edges for the same
    pair are the same connection. */
export function edgePairKey(a: string, b: string): string {
  return a < b ? `${a}${b}` : `${b}${a}`
}

interface SuggestConfig {
  simThreshold: number
  maxPerNode: number
}

function cosine(a: number[], normA: number, b: number[], normB: number): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s / (normA * normB || 1)
}

/**
 * Machine-suggested edges: cosine-similar pairs whose nodes belong to
 * DIFFERENT domains (top-level group), thresholded and capped per node.
 * An edge survives if either endpoint ranks it in its top-K. Deterministic:
 * iteration follows array order, ties break on id, and the edge id is
 * derived from the pair — so confirming a suggestion preserves its identity.
 *
 * Nodes whose layout vector is missing or ALL-ZERO are excluded entirely:
 * a freshly created item has no meaningful content yet, so it must not
 * attract machine suggestions (users confirm connections deliberately).
 */
export function suggestEdges<N extends { id: string }>(
  nodes: N[],
  domainOf: (n: N) => string,
  vectorOf: (n: N) => number[] | undefined,
  cfg: SuggestConfig = layoutConfig.edges,
): CavinEdge[] {
  const items: { id: string; domain: string; vec: number[]; norm: number }[] = []
  for (const n of nodes) {
    const vec = vectorOf(n)
    if (!vec || vec.length === 0) continue
    const norm = Math.sqrt(cosine(vec, 1, vec, 1))
    if (norm === 0) continue // degenerate vector — never suggest
    items.push({ id: n.id, domain: domainOf(n), vec, norm })
  }

  // Per-node candidate lists, trimmed to top-K at the end.
  const byNode = new Map<string, { other: string; sim: number }[]>()
  const push = (id: string, other: string, sim: number) => {
    const list = byNode.get(id)
    if (list) list.push({ other, sim })
    else byNode.set(id, [{ other, sim }])
  }
  for (let i = 0; i < items.length; i++) {
    const a = items[i]
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j]
      if (a.domain === b.domain) continue
      const sim = cosine(a.vec, a.norm, b.vec, b.norm)
      if (sim < cfg.simThreshold) continue
      push(a.id, b.id, sim)
      push(b.id, a.id, sim)
    }
  }

  const kept = new Map<string, { from: string; to: string }>()
  const keep = (a: string, b: string) => {
    const key = edgePairKey(a, b)
    if (!kept.has(key)) kept.set(key, a < b ? { from: a, to: b } : { from: b, to: a })
  }
  for (const [id, cands] of byNode) {
    cands.sort((x, y) => y.sim - x.sim || x.other.localeCompare(y.other))
    for (const c of cands.slice(0, cfg.maxPerNode)) {
      keep(id, c.other)
    }
  }

  // Ids are carried alongside the pair key rather than recovered by
  // splitting it — node ids may legitimately contain the delimiter.
  const out: CavinEdge[] = []
  for (const [key, { from, to }] of kept) {
    out.push({ id: `sugg:${key}`, from, to, createdAt: 0 })
  }
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

/**
 * Merge confirmed (persisted) and suggested edges into the renderable list:
 * dangling references dropped, self-loops dropped, and a confirmed edge
 * shadows the suggested one for the same pair.
 */
export function mergeEdges(
  confirmed: CavinEdge[],
  suggested: CavinEdge[],
  nodeIds: Set<string>,
): WorldEdge[] {
  const out: WorldEdge[] = []
  const confirmedPairs = new Set<string>()
  for (const e of confirmed) {
    if (e.from === e.to || !nodeIds.has(e.from) || !nodeIds.has(e.to)) continue
    confirmedPairs.add(edgePairKey(e.from, e.to))
    out.push({ ...e, kind: 'confirmed' })
  }
  for (const e of suggested) {
    if (e.from === e.to || !nodeIds.has(e.from) || !nodeIds.has(e.to)) continue
    if (confirmedPairs.has(edgePairKey(e.from, e.to))) continue
    out.push({ ...e, kind: 'suggested' })
  }
  return out
}

/** node id → edges touching it, for the detail panel and render passes. */
export function indexEdgesByNode(edges: WorldEdge[]): Map<string, WorldEdge[]> {
  const map = new Map<string, WorldEdge[]>()
  const push = (id: string, e: WorldEdge) => {
    const list = map.get(id)
    if (list) list.push(e)
    else map.set(id, [e])
  }
  for (const e of edges) {
    push(e.from, e)
    push(e.to, e)
  }
  return map
}
