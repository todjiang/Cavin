import { layoutConfig } from './config'
import type { LayoutConfig } from './config'
import type { SchemaAdapter } from './adapter'
import type {
  CavinNode,
  GroupCluster,
  SelectionFocus,
  TreeMutationOutcome,
  World,
} from './types'
import type { CavinEdge } from './edges'
import { indexEdgesByNode, mergeEdges, suggestEdges } from './edges'
import { defaultHue, hsl, hueFromColor } from './colors'

/** Separator for group-path keys — cannot appear in a path segment. */
const PATH_SEP = '\u0001'

/** Group-path key: `GroupCluster.id` and the `groupByPath` lookup key. */
export function groupPathKey(path: string[]): string {
  return path.join(PATH_SEP)
}

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

/** First-encounter order of top-level group segments — the stable indexing
    behind the default hue rotation (generated datasets emit groups in order). */
function topLevelOrder(nodes: CavinNode[]): Map<string, number> {
  const order = new Map<string, number>()
  for (const n of nodes) {
    const top = n.groupPath[0] ?? ''
    if (top && !order.has(top)) order.set(top, order.size)
  }
  return order
}

/** Presentation color for a group path: the adapter's override or the
    default scheme. Returns the CSS color plus its hue (parsed from the
    color when possible) for alpha-channel variants. */
function colorForGroup(
  path: string[],
  topOrder: Map<string, number>,
  colorOf: ((groupPath: string[]) => string) | undefined,
  config: LayoutConfig,
): { color: string; hue: number } {
  const fallbackHue = path.length
    ? defaultHue(topOrder.get(path[0]) ?? 0)
    : config.layout.ungroupedHue
  const color = path.length
    ? (colorOf?.(path) ?? hsl(fallbackHue))
    : hsl(fallbackHue, config.layout.ungroupedSaturation)
  return { color, hue: hueFromColor(color) ?? fallbackHue }
}

/**
 * Initial layout: top-level groups evenly on a large circle, leaf groups
 * clustered around their top-level center, members Gaussian-jittered around
 * the leaf centroid with radius scaled by `adapter.layoutVectorOf`
 * similarity. Pure — used only for the seeded first boot (and demo resets);
 * afterwards positions live in the store and persist. Nodes WITHOUT a
 * groupPath get one from `adapter.groupOf` first.
 */
export function layoutNodes<TAttr>(
  raw: CavinNode<TAttr>[],
  adapter: SchemaAdapter<TAttr>,
  config: LayoutConfig = layoutConfig,
): CavinNode<TAttr>[] {
  const { topLevelRadius, groupSpreadMin, groupSpreadMax, itemSigma, childOrbitSigma } =
    config.layout
  const rand = hashRand(0x1a7)
  const nodes = raw.map((n) => ({ ...n, groupPath: n.groupPath ?? adapter.groupOf(n) }))

  // Top-level groups evenly on a large circle (first-encounter order).
  const topOrder = topLevelOrder(nodes)
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

  // Parents always precede their children in generated arrays, so a child
  // can anchor to its already-placed parent as we walk.
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

/**
 * Derive the renderable world (cluster aggregates, lookup maps, tree
 * indexes, edges) from a node array. Runs on boot and after every mutation.
 *
 * Rules:
 * - Clusters are anchored by ROOT nodes only (`!parentId`): children never
 *   warp cluster geometry, but do count.
 * - Children with a missing parent (defensive — cascades should prevent it)
 *   are promoted to roots.
 * - Unplaced children are normalized to `parent.position + relOffset`, so a
 *   child's home follows its parent automatically.
 * - Free-placed roots keep their position and are excluded from their
 *   cluster's centroid/radius.
 * - Clusters with no members left disappear; one whose roots all went
 *   free-placed keeps its previous centroid.
 */
export function deriveWorld<TAttr>(
  rawNodes: CavinNode<TAttr>[],
  adapter: SchemaAdapter<TAttr>,
  prev?: World<TAttr>,
  confirmedEdges: CavinEdge[] = [],
  config: LayoutConfig = layoutConfig,
): World<TAttr> {
  // Fresh copies with a normalized groupPath — callers may pass stored
  // objects. groupPath is adapter-derived when a node arrives without one.
  const nodes: CavinNode<TAttr>[] = rawNodes.map((n) => ({
    ...n,
    groupPath: n.groupPath ?? adapter.groupOf(n),
  }))
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

  // Unplaced children ride their parent's position (parents precede children
  // in every array we build, so the parent's position is already final).
  for (const n of nodes) {
    if (n.parentId && !n.state.placed && n.state.relOffset) {
      const parent = nodeById.get(n.parentId)!
      n.position = [
        parent.position[0] + n.state.relOffset[0],
        parent.position[1] + n.state.relOffset[1],
      ]
    }
  }

  // Generic group clusters over groupPath — at ARBITRARY depth. A cluster
  // exists for every prefix of every node's path. Leaf clusters apply the
  // cluster rules verbatim (grid-bound roots anchor the centroid, free-placed
  // roots are excluded, an emptied cluster keeps its previous centroid);
  // interior clusters apply the containment rules (centroid = mean of direct
  // sub-cluster centroids, radius covers them). Ungrouped nodes (empty path)
  // belong to no cluster.
  interface GroupAgg {
    path: string[]
    key: string
    /** Nodes whose full path equals this path, in node order (children included). */
    members: CavinNode<TAttr>[]
    /** Direct sub-cluster keys, in first-encounter order. */
    children: string[]
  }
  const aggByKey = new Map<string, GroupAgg>()
  for (const n of nodes) {
    const path = n.groupPath ?? []
    for (let d = 1; d <= path.length; d++) {
      const p = path.slice(0, d)
      const key = p.join(PATH_SEP)
      let agg = aggByKey.get(key)
      if (!agg) {
        agg = { path: p, key, members: [], children: [] }
        aggByKey.set(key, agg)
        if (d > 1) {
          // The parent prefix was created one iteration earlier in this walk.
          aggByKey.get(path.slice(0, d - 1).join(PATH_SEP))!.children.push(key)
        }
      }
      if (d === path.length) agg.members.push(n)
    }
  }
  const clusterByKey = new Map<string, GroupCluster>()
  const topOrder = topLevelOrder(nodes)
  // Deepest first, so interior clusters find their children already computed.
  const aggsDeepFirst = [...aggByKey.values()].sort((a, b) => b.path.length - a.path.length)
  for (const agg of aggsDeepFirst) {
    const depth = agg.path.length - 1
    let centroid: [number, number]
    let radius: number
    let count = agg.members.length
    if (agg.children.length > 0) {
      const kids = agg.children.map((k) => clusterByKey.get(k)!)
      centroid = [0, 0]
      for (const k of kids) {
        centroid[0] += k.centroid[0] / kids.length
        centroid[1] += k.centroid[1] / kids.length
      }
      radius = 0
      for (const k of kids) {
        const d = Math.hypot(k.centroid[0] - centroid[0], k.centroid[1] - centroid[1]) + k.radius
        if (d > radius) radius = d
      }
      count += kids.reduce((s, k) => s + k.count, 0)
    } else {
      const roots = agg.members.filter((m) => !m.parentId)
      const gridRoots = roots.filter((m) => !m.state.placed)
      const anchor = gridRoots.length > 0 ? gridRoots : roots.length > 0 ? roots : agg.members
      centroid = [0, 0]
      for (const m of anchor) {
        centroid[0] += m.position[0] / anchor.length
        centroid[1] += m.position[1] / anchor.length
      }
      if (gridRoots.length === 0 && prev?.groupByPath.has(agg.key)) {
        centroid = prev.groupByPath.get(agg.key)!.centroid
      }
      radius = config.layout.clusterRadiusMin
      for (const m of gridRoots) {
        const d = Math.hypot(m.position[0] - centroid[0], m.position[1] - centroid[1])
        if (d > radius) radius = d
      }
    }
    const { color, hue } = colorForGroup(agg.path, topOrder, adapter.colorOf, config)
    clusterByKey.set(agg.key, {
      id: agg.key,
      path: agg.path,
      name: agg.path[depth],
      depth,
      centroid,
      radius,
      count,
      color,
      hue,
    })
  }
  // Coarse → fine, first-encounter order within a depth (stable paint order).
  const groups = [...aggByKey.values()]
    .sort((a, b) => a.path.length - b.path.length)
    .map((a) => clusterByKey.get(a.key)!)

  // Cross-domain connections: machine-suggested pairs are recomputed from
  // layout vectors on every derive (domain = top-level group path); the
  // persisted confirmed list shadows matching suggestions. Dangling edges
  // (deleted endpoint) are dropped here — deletion is never blocked.
  const suggested = suggestEdges(
    nodes,
    (n) => n.groupPath[0] ?? '',
    (n) => adapter.layoutVectorOf?.(n),
  )
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

/** Presentation color index for node dots/chips: per top-level group, the
    adapter's colorOf or the default scheme. Ungrouped nodes get the neutral
    config tint. Rebuilt per world (cheap: one entry per top group). */
export function nodeColorIndex<TAttr>(
  world: World<TAttr>,
  adapter: SchemaAdapter<TAttr>,
  config: LayoutConfig = layoutConfig,
): Map<string, { color: string; hue: number }> {
  const topOrder = topLevelOrder(world.nodes)
  const index = new Map<string, { color: string; hue: number }>()
  for (const [top] of topOrder) {
    index.set(top, colorForGroup([top], topOrder, adapter.colorOf, config))
  }
  index.set('', colorForGroup([], topOrder, adapter.colorOf, config))
  return index
}

/**
 * The selection spotlight set: the selected node, the other ends of its
 * confirmed edges, plus its tree context (children and the ancestor chain —
 * a node's place stays visible while its relations light up).
 * Returns null when there is no selection or the node has no confirmed
 * edges; callers fall back to the plain (non-isolating) spotlight then.
 */
export function focusForSelection<TAttr>(
  world: World<TAttr>,
  selectedId: string | null,
): SelectionFocus | null {
  if (!selectedId || !world.nodeById.has(selectedId)) return null
  const edgeIds = new Set<string>()
  const ringIds = new Set<string>()
  const nodeIds = new Set<string>([selectedId])
  for (const e of world.edgesByNode.get(selectedId) ?? []) {
    if (e.kind !== 'confirmed') continue
    edgeIds.add(e.id)
    const other = e.from === selectedId ? e.to : e.from
    ringIds.add(other)
    nodeIds.add(other)
  }
  if (edgeIds.size === 0) return null
  const childIds: string[] = []
  for (const c of world.childrenByParent.get(selectedId) ?? []) {
    nodeIds.add(c.id)
    if (!c.state.placed && !ringIds.has(c.id)) childIds.push(c.id)
  }
  let cur = world.nodeById.get(selectedId)
  while (cur?.parentId) {
    nodeIds.add(cur.parentId)
    cur = world.nodeById.get(cur.parentId)
  }
  return { id: selectedId, nodeIds, edgeIds, ringIds, childIds }
}

/**
 * The set a delete would actually remove: the node plus its descendants,
 * except that a locked node shields itself and its whole branch. The node
 * itself is assumed unlocked (the command layer guards that before calling).
 */
export function deletableSubtree<TAttr>(world: World<TAttr>, rootId: string): Set<string> {
  const out = new Set<string>()
  const walk = (id: string, isRoot: boolean) => {
    const node = world.nodeById.get(id)
    if (!node) return
    if (!isRoot && node.state.locked) return // locked branch shields itself
    out.add(id)
    for (const child of world.childrenByParent.get(id) ?? []) walk(child.id, false)
  }
  walk(rootId, true)
  return out
}

/** Ids of a node's movable subtree: itself + descendants, minus locked branches. */
export function movableSubtree<TAttr>(world: World<TAttr>, rootId: string): Set<string> {
  const out = new Set<string>()
  const walk = (id: string, isRoot: boolean) => {
    const node = world.nodeById.get(id)
    if (!node) return
    if (!isRoot && node.state.locked) return
    out.add(id)
    for (const child of world.childrenByParent.get(id) ?? []) walk(child.id, false)
  }
  walk(rootId, true)
  return out
}

/* ------------------------------------------------------------------ */
/* Pure tree mutations — the refinement operations. Each returns a    */
/* new node array; the command layer feeds it through deriveWorld.     */
/* ------------------------------------------------------------------ */

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
  const subtree = new Set<string>()
  const walk = (cur: string, isRoot: boolean) => {
    const n = byId.get(cur)
    if (!n) return
    if (!isRoot && n.state.locked) return
    subtree.add(cur)
    for (const c of kids.get(cur) ?? []) walk(c.id, false)
  }
  walk(id, true)

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

/** smoothstep(a, b, x) */
export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Time-dimension factor in [0,1]: at timeT=0 everything is bright; as the
 * slider moves right, nodes older than the cutoff dim/shrink away (older =
 * dimmer). The domain is data-derived — `timeRangeOf` over the adapter's
 * time-axis field — never module-load time.
 */
export function timeFactor(t: number, range: [number, number], timeT: number): number {
  const [min, max] = range
  const cutoff = min + timeT * (max - min)
  const ramp = 0.12 * (max - min)
  return smoothstep(cutoff, cutoff + ramp, t)
}

export const DAY_MS = 24 * 60 * 60 * 1000
