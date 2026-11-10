import type { CavinNode, GroupCluster, World } from './types'

/**
 * Tree queries over a derived World — the single implementations of the
 * questions renderers and commands used to each re-derive privately:
 * "collect a subtree", "deepest grouping level", "nearest group at a point".
 *
 * The World already carries the tree index (`childrenByParent`), so these
 * never rebuild one. `subtreeFrom` is the same traversal over a looser
 * (id, children) pair for code that runs BEFORE a derive (the pure
 * mutations, which take node arrays by design — see layout.ts).
 */

export interface SubtreeOptions {
  /** Locked nodes shield their whole branch — the delete/move semantics.
      Pass `false` to ignore locks, and say why at the call site: the
      re-parent picker excludes descendants regardless of locks because the
      cycle guard refuses them anyway, so hiding locked descendants would
      only mislead. */
  stopAtLocked?: boolean
}

/** Lower-level subtree walk over an explicit (getNode, childrenOf) pair. */
export function subtreeFrom<TAttr>(
  getNode: (id: string) => CavinNode<TAttr> | undefined,
  childrenOf: (id: string) => readonly CavinNode<TAttr>[],
  rootId: string,
  opts: SubtreeOptions = {},
): Set<string> {
  const { stopAtLocked = true } = opts
  const out = new Set<string>()
  const walk = (id: string, isRoot: boolean) => {
    const node = getNode(id)
    if (!node) return
    if (!isRoot && stopAtLocked && node.state.locked) return
    out.add(id)
    for (const child of childrenOf(id)) walk(child.id, false)
  }
  walk(rootId, true)
  return out
}

/** The subtree rooted at `rootId` (root included). With the default lock
    shielding this is exactly the set a delete would remove or a move would
    carry — the root itself is assumed reachable (callers guard first). */
export function subtree<TAttr>(world: World<TAttr>, rootId: string, opts: SubtreeOptions = {}): Set<string> {
  return subtreeFrom(
    (id) => world.nodeById.get(id),
    (id) => world.childrenByParent.get(id) ?? [],
    rootId,
    opts,
  )
}

/** The deepest grouping level present (-1 when the world has no groups). */
export function deepestDepth<TAttr>(world: World<TAttr>): number {
  let max = -1
  for (const g of world.groups) if (g.depth > max) max = g.depth
  return max
}

/** Every cluster at the deepest grouping level present. */
export function leafGroups<TAttr>(world: World<TAttr>): GroupCluster[] {
  const depth = deepestDepth(world)
  return depth < 0 ? [] : world.groups.filter((g) => g.depth === depth)
}

/** Clusters bucketed by depth: index d holds every cluster at level d, so
    renderers can iterate bands without naming depths. Empty when the world
    has no groups (a flat host gets no phantom bands). */
export function groupsByDepth<TAttr>(world: World<TAttr>): GroupCluster[][] {
  const out: GroupCluster[][] = []
  for (const g of world.groups) {
    ;(out[g.depth] ??= []).push(g)
  }
  return out
}

/** Nearest cluster at the deepest grouping level — where a new root lands,
    what the breadcrumb shows. Null when the world has no groups. */
export function nearestGroup<TAttr>(
  world: World<TAttr>,
  at: [number, number],
): GroupCluster | null {
  let best: GroupCluster | null = null
  let bestD = Infinity
  for (const g of leafGroups(world)) {
    const d = Math.hypot(g.centroid[0] - at[0], g.centroid[1] - at[1])
    if (d < bestD) {
      bestD = d
      best = g
    }
  }
  return best
}

/**
 * Stable parents-first ordering of a node array: sort by tree depth (parent
 * chain length), ties keep the original array order. Cycles are walked with
 * a seen-guard, so cyclic input degrades to its original order instead of
 * hanging. `deriveWorld` and `layoutNodes` both require this contract —
 * parents precede children — and repair violations here rather than
 * silently anchoring children to a parent's stale stored position.
 */
export function orderParentsFirst<TAttr>(nodes: CavinNode<TAttr>[]): CavinNode<TAttr>[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const depthOf = (n: CavinNode<TAttr>): number => {
    let d = 0
    const seen = new Set<string>()
    let cur: CavinNode<TAttr> | undefined = n
    while (cur?.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id)
      d++
      cur = byId.get(cur.parentId)
    }
    return d
  }
  return nodes
    .map((n, i) => [n, i] as const)
    .sort((a, b) => depthOf(a[0]) - depthOf(b[0]) || a[1] - b[1])
    .map(([n]) => n)
}
