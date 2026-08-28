import { focusForSelection, layoutConfig } from '@cavin/core'
import { useCavin } from '../context'
import { lodLevels } from '@cavin/core'

const { edges: EDGES } = layoutConfig

/**
 * DOM cluster name labels. Top-level labels dominate zoomed out and fade as
 * sub-cluster labels appear; sub-cluster labels fade out again as full cards
 * take over. All ramps are continuous functions of zoom — no pop-in. Labels
 * counter-scale to keep a constant screen size. While a selection focus is
 * active they dim to background context: the constellation has left their
 * geography behind.
 */
export function ClusterLabels() {
  const { view: useView, world: useWorld } = useCavin()
  // Subscribe to zoom only — positions are world-anchored via the parent
  // `.world` transform, so pan (x/y) changes must not re-render this layer.
  const zoom = useView((s) => s.cam.zoom)
  const zRooms = useView((s) => s.zRooms)
  const zCards = useView((s) => s.zCards)
  const selectedId = useView((s) => s.selectedId)
  const world = useWorld((s) => s.world)
  const lv = lodLevels(zoom, zRooms, zCards)
  const dim = focusForSelection(world, selectedId) ? EDGES.focusLabelAlpha : 1
  const inv = 1 / zoom
  // Generic groups sliced by depth: depth 0 plays the top-level label band,
  // depth 1 the sub-cluster label band.
  const topGroups = world.groups.filter((g) => g.depth === 0)
  const subGroups = world.groups.filter((g) => g.depth === 1)

  return (
    <>
      {lv.wings > 0.01 &&
        topGroups.map((w) => (
          <div
            key={w.id}
            className="world-anchor"
            style={{ transform: `translate(${w.centroid[0]}px, ${w.centroid[1]}px)` }}
          >
            <div
              className="wing-label"
              style={{ opacity: lv.wings * 0.95 * dim, color: w.color, borderColor: w.color, transform: `translate(-50%, -50%) scale(${inv})` }}
            >
              {w.name}
              <span className="cluster-count">{w.count}</span>
            </div>
          </div>
        ))}
      {lv.rooms > 0.01 &&
        subGroups.map((r) => (
          <div
            key={r.id}
            className="world-anchor"
            style={{ transform: `translate(${r.centroid[0]}px, ${r.centroid[1]}px)` }}
          >
            <div
              className="cluster-label"
              style={{ opacity: lv.rooms * 0.85 * dim, color: r.color, borderColor: r.color, transform: `translate(-50%, -50%) scale(${inv})` }}
            >
              {r.name}
              <span className="cluster-count">{r.count}</span>
            </div>
          </div>
        ))}
    </>
  )
}
