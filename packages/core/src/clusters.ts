import { layoutConfig } from './config'
import type { LayoutConfig } from './config'
import type { SchemaAdapter } from './adapter'
import type { CavinNode, GroupCluster, World } from './types'
import { defaultHue, hsl, hueFromColor } from './colors'

/** Separator for group-path keys — cannot appear in a path segment. */
export const PATH_SEP = '\u0001'

/** Group-path key: `GroupCluster.id` and the `groupByPath` lookup key. */
export function groupPathKey(path: string[]): string {
  return path.join(PATH_SEP)
}

/** First-encounter order of top-level group segments — the stable indexing
    behind the default hue rotation (generated datasets emit groups in order). */
export function topLevelOrder(nodes: CavinNode[]): Map<string, number> {
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
export function colorForGroup(
  path: string[],
  topOrder: Map<string, number>,
  colorOf: ((groupPath: string[]) => string) | undefined,
  config: LayoutConfig,
): { color: string; hue: number } {
  const fallbackHue = path.length
    ? defaultHue(topOrder.get(path[0]) ?? 0, config)
    : config.layout.ungroupedHue
  const color = path.length
    ? (colorOf?.(path) ?? hsl(fallbackHue, config))
    : hsl(fallbackHue, config, config.layout.ungroupedSaturation)
  return { color, hue: hueFromColor(color) ?? fallbackHue }
}

interface GroupAgg {
  path: string[]
  key: string
  /** Nodes whose full path equals this path, in node order (children included). */
  members: CavinNode[]
  /** Direct sub-cluster keys, in first-encounter order. */
  children: string[]
}

/**
 * Generic group clusters over groupPath — at ARBITRARY depth. A cluster
 * exists for every prefix of every node's path. Leaf clusters apply the
 * cluster rules verbatim (grid-bound roots anchor the centroid, free-placed
 * roots are excluded, an emptied cluster keeps its previous centroid);
 * interior clusters apply the containment rules (centroid = mean of direct
 * sub-cluster centroids, radius covers them). Ungrouped nodes (empty path)
 * belong to no cluster.
 *
 * Colour is assigned in the same single pass — `nodeColorIndex` reads the
 * result back from the clusters instead of recomputing the top-level order
 * and palette a second time.
 *
 * Invariants (checked in groups.test.ts):
 * - Clusters are anchored by ROOT nodes only (`!parentId`): children never
 *   warp cluster geometry, but do count.
 * - Clusters with no members left disappear; one whose roots all went
 *   free-placed keeps its previous centroid (`prev`).
 */
export function deriveClusters<TAttr>(
  nodes: CavinNode<TAttr>[],
  adapter: SchemaAdapter<TAttr>,
  prev: World<TAttr> | undefined,
  config: LayoutConfig,
): { groups: GroupCluster[]; clusterByKey: Map<string, GroupCluster> } {
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
  return { groups, clusterByKey }
}

/** Presentation color index for node dots/chips: per top-level group, read
    back from the clusters the derive already coloured — colour is computed
    once per world, not a second time. Ungrouped nodes get the neutral
    config tint. */
export function nodeColorIndex<TAttr>(
  world: World<TAttr>,
  config: LayoutConfig = layoutConfig,
): Map<string, { color: string; hue: number }> {
  const index = new Map<string, { color: string; hue: number }>()
  for (const g of world.groups) {
    if (g.depth === 0) index.set(g.path[0] ?? '', { color: g.color, hue: g.hue })
  }
  index.set('', {
    color: hsl(config.layout.ungroupedHue, config, config.layout.ungroupedSaturation),
    hue: config.layout.ungroupedHue,
  })
  return index
}
