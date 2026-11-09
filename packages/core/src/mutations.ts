import { layoutConfig } from './config'
import type { LayoutConfig } from './config'
import type { SchemaAdapter } from './adapter'
import type { CavinNode, TreeMutationOutcome } from './types'
import { groupPathKey } from './clusters'
import { orderParentsFirst, subtreeFrom } from './tree'

/**
 * Pure tree mutations and the initial scatter layout — the refinement
 * operations. Each takes and returns a node array; the command layer feeds
 * the result through `deriveWorld`. They intentionally do NOT take a World:
 * they run pre-derive, where the tree indexes do not exist yet.
 */

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a))
}

/** Deterministic pseudo-random from an integer seed (layout-only, independent of data seed). */
function hashRand(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Initial layout: top-level groups evenly on a large circle, leaf groups
 * clustered around their top-level center, members Gaussian-jittered around
 * the leaf centroid with radius scaled by `adapter.layoutVectorOf`
 * similarity. Pure — used only for the seeded first boot (and demo resets);
 * afterwards positions live in the store and persist. `groupPath` is
 * authoritative — every node must arrive with one (the host's `validate`
 * sets it; see `CavinNode.groupPath`).
 *
 * The input is repaired to parents-first order (`orderParentsFirst`) before
 * the anchoring walk: a child-first array would otherwise anchor children to
 * their parent's stored (unlaid) position and land parentless-looking.
 */
export function layoutNodes<TAttr>(
  raw: CavinNode<TAttr>[],
  adapter: SchemaAdapter<TAttr>,
  config: LayoutConfig = layoutConfig,
): CavinNode<TAttr>[] {
  const { topLevelRadius, groupSpreadMin, groupSpreadMax, itemSigma, childOrbitSigma } =
    config.layout
  const rand = hashRand(0x1a7)
  let nodes = raw.map((n) => ({ ...n }))
  nodes = orderParentsFirst(nodes)

  // Top-level groups evenly on a large circle (first-encounter order).
  const topOrder = new Map<string, number>()
  for (const n of nodes) {
    const top = n.groupPath[0] ?? ''
    if (top && !topOrder.has(top)) topOrder.set(top, topOrder.size)
  }
  const topCenters = new Map<string, [number, number]>()
  let topIndex = 0
  for (const n of nodes) {
    const top = n.groupPath[0] ?? ''
    if (!top || topCenters.has(top)) continue
    const a = (topIndex / topOrder.size) * Math.PI * 2 - Math.PI / 2
    topCenters.set(top, [Math.cos(a) * topLevelRadius, Math.sin(a) * topLevelRadius])
    topIndex++
  }
  // Ungrouped nodes scatter around the origin.
  topCenters.set('', [0, 0])

  // Leaf clusters around their top-level center.
  const leafKeys: string[] = []
  const leafTop = new Map<string, string>()
  for (const n of nodes) {
    const key = groupPathKey(n.groupPath)
    if (!leafTop.has(key)) {
      leafKeys.push(key)
      leafTop.set(key, n.groupPath[0] ?? '')
    }
  }
  const leafCenters = new Map<string, [number, number]>()
  for (const key of leafKeys) {
    const wc = topCenters.get(leafTop.get(key)!)!
    const spread = groupSpreadMin + rand() * (groupSpreadMax - groupSpreadMin)
    const a = rand() * Math.PI * 2
    leafCenters.set(key, [wc[0] + Math.cos(a) * spread, wc[1] + Math.sin(a) * spread])
  }

  // Leaf base vector = mean of root member vectors (clustered data spreads
  // members around their cluster's mean; similarity scales their radius).
  const vectorOf = (n: CavinNode<TAttr>) => adapter.layoutVectorOf?.(n)
  const roots = nodes.filter((n) => !n.parentId)
  const leafBase = new Map<string, number[]>()
  for (const key of leafKeys) {
    const members = roots.filter((n) => groupPathKey(n.groupPath) === key)
    const first = members.map(vectorOf).find((v) => v && v.length > 0)
    const dim = first?.length ?? 8
    const mean = new Array(dim).fill(0)
    let count = 0
    for (const m of members) {
      const v = vectorOf(m)
      if (!v || v.length !== dim) continue
      for (let i = 0; i < dim; i++) mean[i] += v[i] / members.length
      count++
    }
    leafBase.set(key, count > 0 ? mean : new Array(dim).fill(0))
  }

  // The walk below requires parents-first order; orderParentsFirst above
  // guarantees it, so a child anchors to its already-placed parent.
  const laidById = new Map<string, CavinNode<TAttr>>()
  const gauss = () => (rand() + rand() + rand() - 1.5) * 2 // approx normal in [-3, 3]
  return nodes.map((n) => {
    let laid: CavinNode<TAttr>
    if (n.parentId && laidById.has(n.parentId)) {
      // Child: tight radial jitter around its parent, remembered as relOffset.
      const parent = laidById.get(n.parentId)!
      const relOffset: [number, number] = [gauss() * childOrbitSigma, gauss() * childOrbitSigma]
      laid = {
        ...n,
        position: [parent.position[0] + relOffset[0], parent.position[1] + relOffset[1]],
        state: { ...n.state, relOffset },
      }
    } else {
      // Root: jitter around the leaf centroid, radius scaled by similarity.
      const key = groupPathKey(n.groupPath)
      const lc = leafCenters.get(key)!
      const lb = leafBase.get(key)!
      const v = vectorOf(n)
      const sim =
        v && v.length === lb.length ? dot(v, lb) / (norm(v) * norm(lb) || 1) : 0 // cosine-ish
      const radiusScale = 0.7 + 0.6 * Math.max(0, Math.min(1, sim))
      laid = {
        ...n,
        position: [
          lc[0] + gauss() * itemSigma * radiusScale,
          lc[1] + gauss() * itemSigma * radiusScale,
        ],
      }
    }
    laidById.set(n.id, laid)
    return laid
  })
}

function childrenIndex<TAttr>(nodes: CavinNode<TAttr>[]): Map<string, CavinNode<TAttr>[]> {
  const map = new Map<string, CavinNode<TAttr>[]>()
  for (const n of nodes) {
    if (!n.parentId) continue
    const list = map.get(n.parentId) ?? []
    list.push(n)
    map.set(n.parentId, list)
  }
  return map
}

/**
 * Re-parent `id` under `newParentId`: the node re-joins the new parent's
 * orbit at a fresh relOffset, and the whole movable subtree crosses into
 * the new parent's group path so colors, breadcrumbs and cluster membership
 * stay consistent. Refuses cycles and locked nodes/targets. Dropping a
 * free-placed child back onto its current parent re-joins the orbit.
 */
export function reparentNodes<TAttr>(
  nodes: CavinNode<TAttr>[],
  id: string,
  newParentId: string,
  rand: () => number = Math.random,
  config: LayoutConfig = layoutConfig,
): TreeMutationOutcome<TAttr> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const node = byId.get(id)
  const parent = byId.get(newParentId)
  if (!node || !parent) return { ok: false, error: 'missing' }
  if (id === newParentId) return { ok: false, error: 'self' }
  if (node.state.locked) return { ok: false, error: 'locked-node' }
  if (parent.state.locked) return { ok: false, error: 'locked-target' }

  if (node.parentId === newParentId) {
    if (!node.state.placed) return { ok: false, error: 'noop' }
    return {
      ok: true,
      kind: 'rejoined',
      nodes: nodes.map((n) =>
        n.id === id ? { ...n, state: { ...n.state, placed: false } } : n,
      ),
    }
  }

  // Cycle guard: the new parent must not be the node or its descendant.
  for (
    let p: CavinNode<TAttr> | undefined = parent;
    p;
    p = p.parentId ? byId.get(p.parentId) : undefined
  ) {
    if (p.id === id) return { ok: false, error: 'cycle' }
  }

  const kids = childrenIndex(nodes)
  // The movable subtree crosses into the new parent's group — same
  // traversal as delete/move (tree.subtreeFrom over this pre-derive index).
  const subtree = subtreeFrom(
    (nid) => byId.get(nid),
    (nid) => kids.get(nid) ?? [],
    id,
  )

  const angle = rand() * Math.PI * 2
  const radius =
    config.layout.childSpawnRadiusMin + rand() * config.layout.childSpawnRadiusSpread
  const relOffset: [number, number] = [Math.cos(angle) * radius, Math.sin(angle) * radius]
  // The subtree crosses into the new parent's group path — clusters are
  // aggregated from groupPath, so leaving it stale would strand the moved
  // nodes in their old cluster.
  const groupPath = [...parent.groupPath]
  return {
    ok: true,
    kind: 'reparented',
    nodes: nodes.map((n) => {
      if (!subtree.has(n.id)) return n
      if (n.id !== id) return { ...n, groupPath }
      return {
        ...n,
        groupPath,
        parentId: newParentId,
        state: {
          ...n.state,
          relOffset,
          placed: false,
        },
        position: [
          parent.position[0] + relOffset[0],
          parent.position[1] + relOffset[1],
        ] as [number, number],
      }
    }),
  }
}

/**
 * Promote a child to a root: drops the parent link and pins the node where
 * it sits (free-placed), keeping its group context. The children of the
 * node stay attached to it — only the upward link breaks.
 */
export function promoteToRootNodes<TAttr>(
  nodes: CavinNode<TAttr>[],
  id: string,
): TreeMutationOutcome<TAttr> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const node = byId.get(id)
  if (!node) return { ok: false, error: 'missing' }
  if (node.state.locked) return { ok: false, error: 'locked-node' }
  if (!node.parentId) return { ok: false, error: 'noop' }
  return {
    ok: true,
    kind: 'promoted',
    nodes: nodes.map((n) =>
      n.id === id
        ? {
            ...n,
            parentId: undefined,
            state: { ...n.state, relOffset: undefined, placed: true },
          }
        : n,
    ),
  }
}
