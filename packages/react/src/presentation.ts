import type { CavinNode, GroupCluster, LayoutConfig, SchemaAdapter, World } from '@cavin/core'
import { layoutConfig, nodeColorIndex, timeFactor, timeOf, timeRangeOf } from '@cavin/core'

/**
 * Presentation cache: colors and time-dimming are derived from the adapter
 * at render time (nodes never carry them), so imperative render loops build
 * one palette per world — identity-checked, rebuilt only when the world
 * object changes.
 */
export interface Palette<TAttr = unknown> {
  nodeColor: (node: CavinNode<TAttr>) => string
  nodeHue: (node: CavinNode<TAttr>) => number
  clusterHue: (cluster: GroupCluster) => number
  /** Time-dimension factor in [0,1]; 1 when the adapter declares no time axis. */
  timeDim: (node: CavinNode<TAttr>, timeT: number) => number
}

export function buildPalette<TAttr>(
  adapter: SchemaAdapter<TAttr>,
  world: World<TAttr>,
  config: LayoutConfig = layoutConfig,
): Palette<TAttr> {
  const colorIndex = nodeColorIndex(world, config)
  const range = timeRangeOf(world.nodes, adapter)
  const neutral = colorIndex.get('')!
  return {
    nodeColor: (n) => colorIndex.get(n.groupPath[0] ?? '')?.color ?? neutral.color,
    nodeHue: (n) => colorIndex.get(n.groupPath[0] ?? '')?.hue ?? neutral.hue,
    clusterHue: (c) => c.hue,
    timeDim: (n, timeT) => {
      if (!range) return 1
      const t = timeOf(adapter, n)
      if (t === undefined) return 1
      return timeFactor(t, range, timeT)
    },
  }
}

/** Identity-checked palette for imperative rAF loops. Keyed on `world.groups`
    rather than the world itself: a drag frame mints a fresh `World` every
    frame but keeps the groups array (and everything a palette derives from —
    group first-encounter order, time range) identical, so a dragged frame
    must not rebuild an O(n) palette. Any structural derive produces new
    groups and therefore a rebuild. */
export function paletteMemo<TAttr>(
  adapter: SchemaAdapter<TAttr>,
  config: LayoutConfig = layoutConfig,
) {
  let lastGroups: World<TAttr>['groups'] | null = null
  let last: Palette<TAttr> | null = null
  return (world: World<TAttr>): Palette<TAttr> => {
    if (world.groups !== lastGroups || !last) {
      lastGroups = world.groups
      last = buildPalette(adapter, world, config)
    }
    return last
  }
}
