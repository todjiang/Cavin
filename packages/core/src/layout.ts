import { layoutConfig } from './config'
import type { LayoutConfig } from './config'
import type { SchemaAdapter } from './adapter'
import type { CavinNode, World } from './types'
import type { CavinEdge } from './edges'
import { indexEdgesByNode, mergeEdges } from './edges'
import { orderParentsFirst } from './tree'
import { deriveClusters } from './clusters'

/**
 * The derive module: `deriveWorld` — the projection from a node array to the
 * renderable World (tree indexes, re-anchored positions, clusters, edges).
 * Cluster aggregation and colour live in `clusters.ts`; the refinement
 * operations live in `mutations.ts`; selection queries in `selection.ts`.
 *
 * Compatibility re-exports: the mutations used to live in this file, and
 * in-flight consumers still import them from './layout'.
 */
export { reparentNodes, promoteToRootNodes, layoutNodes } from './mutations'

/**
 * Derive the renderable world (cluster aggregates, lookup maps, tree
 * indexes, edges) from a node array. Runs on boot and after every mutation.
 *
 * Rules:
 * - The input is repaired to parents-first order (`orderParentsFirst`) —
 *   the re-anchoring walk below depends on a parent's position already
 *   being final, and a child-first array is a geometry bug, not an error.
 * - Children with a missing parent (defensive — cascades should prevent it)
 *   are promoted to roots.
 * - Unplaced children are normalized to `parent.position + relOffset`, so a
 *   child's home follows its parent automatically.
 * - Cluster invariants are stated (and tested) in clusters.ts.
 *
 * Suggestions are NOT computed here — `suggestEdges` is an O(n²) sweep whose
 * inputs (top-level group, layout vectors) change far less often than the
 * world derives. The CALL SITE owns the suggestion list and passes it in
 * (recomputing only when those inputs change); derive only merges it with
 * the confirmed list.
 */
export function deriveWorld<TAttr>(
  rawNodes: CavinNode<TAttr>[],
  adapter: SchemaAdapter<TAttr>,
  prev?: World<TAttr>,
  confirmedEdges: CavinEdge[] = [],
  config: LayoutConfig = layoutConfig,
  suggested: CavinEdge[] = [],
): World<TAttr> {
  // Fresh copies — callers may pass stored objects, and the orphan-promotion
  // below mutates parentId. groupPath is authoritative on the node.
  // Parents must precede children (the re-anchor walk depends on it), so a
  // child-first input is repaired, not trusted: stable sort by tree depth.
  let nodes: CavinNode<TAttr>[] = rawNodes.map((n) => ({ ...n }))
  nodes = orderParentsFirst(nodes)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  // Tree indexes; orphan children are promoted to roots defensively.
  const childrenByParent = new Map<string, CavinNode<TAttr>[]>()
  const depthById = new Map<string, number>()
  for (const n of nodes) {
    if (n.parentId && !nodeById.has(n.parentId)) n.parentId = undefined
    if (!n.parentId) continue
    const list = childrenByParent.get(n.parentId) ?? []
    list.push(n)
    childrenByParent.set(n.parentId, list)
  }
  const depthOf = (n: CavinNode<TAttr>): number => {
    const cached = depthById.get(n.id)
    if (cached !== undefined) return cached
    // Chain depth is tiny (≤3); walk up, guarding against cycles.
    let d = 0
    let cur: CavinNode<TAttr> | undefined = n
    const seen = new Set<string>()
    while (cur?.parentId && nodeById.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id)
      d++
      cur = nodeById.get(cur.parentId)
    }
    depthById.set(n.id, d)
    return d
  }
  for (const n of nodes) depthOf(n)

  // Unplaced children ride their parent's position. The array is in
  // parents-first order (repaired above), so the parent's position is
  // already final by the time its children are visited.
  for (const n of nodes) {
    if (n.parentId && !n.state.placed && n.state.relOffset) {
      const parent = nodeById.get(n.parentId)!
      n.position = [
        parent.position[0] + n.state.relOffset[0],
        parent.position[1] + n.state.relOffset[1],
      ]
    }
  }

  // Generic group clusters over groupPath — aggregation and colour in one
  // pass (clusters.ts).
  const { groups, clusterByKey } = deriveClusters(nodes, adapter, prev, config)

  // Cross-domain connections: the caller-owned suggestion list merged with
  // the persisted confirmed list (which shadows matching suggestions).
  // Dangling edges (deleted endpoint) are dropped here — deletion is never
  // blocked.
  const edges = mergeEdges(confirmedEdges, suggested, new Set(nodeById.keys()))
  const edgesByNode = indexEdgesByNode(edges)
  const degreeById = new Map<string, number>()
  let maxDegree = 0
  for (const [id, list] of edgesByNode) {
    degreeById.set(id, list.length)
    if (list.length > maxDegree) maxDegree = list.length
  }

  return {
    nodes,
    groups,
    nodeById,
    groupByPath: clusterByKey,
    childrenByParent,
    depthById,
    edges,
    edgesByNode,
    degreeById,
    maxDegree,
  }
}
