import type { CavinNode, GroupCluster, SchemaAdapter, World } from '@cavin/core'
import { nodeColorIndex, timeFactor, timeOf, timeRangeOf } from '@cavin/core'

/**
 * Presentation cache: colors and time-dimming are derived from the adapter
 * at render time (nodes never carry them), so imperative render loops build
 * one palette per world — identity-checked, rebuilt only when the world
 * object changes.
 */
export interface Palette<TAttr = unknown> {
  nodeColor: (node: CavinNode<TAttr>) => string
  nodeHue: (node: CavinNode<TAttr>) => number
  clusterColor: (cluster: GroupCluster) => string
  clusterHue: (cluster: GroupCluster) => number
  /** Time-dimension factor in [0,1]; 1 when the adapter declares no time axis. */
  timeDim: (node: CavinNode<TAttr>, timeT: number) => number
}

export function buildPalette<TAttr>(
  adapter: SchemaAdapter<TAttr>,
  world: World<TAttr>,
): Palette<TAttr> {
  const colorIndex = nodeColorIndex(world, adapter)
  const range = timeRangeOf(world.nodes, adapter)
  const neutral = colorIndex.get('')!
  return {
    nodeColor: (n) => colorIndex.get(n.groupPath[0] ?? '')?.color ?? neutral.color,
    nodeHue: (n) => colorIndex.get(n.groupPath[0] ?? '')?.hue ?? neutral.hue,
    clusterColor: (c) => c.color,
    clusterHue: (c) => c.hue,
    timeDim: (n, timeT) => {
      if (!range) return 1
      const t = timeOf(adapter, n)
      if (t === undefined) return 1
      return timeFactor(t, range, timeT)
    },
  }
}

/** Identity-checked palette for imperative rAF loops. */
export function paletteMemo<TAttr>(adapter: SchemaAdapter<TAttr>) {
  let lastWorld: World<TAttr> | null = null
  let last: Palette<TAttr> | null = null
  return (world: World<TAttr>): Palette<TAttr> => {
    if (world !== lastWorld || !last) {
      lastWorld = world
      last = buildPalette(adapter, world)
    }
    return last
  }
}
