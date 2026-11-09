import { clusterLevels, focusForSelection, groupsByDepth } from '@cavin/core'
import { useCavin } from '../context'

/**
 * DOM cluster name labels, one band per grouping depth present in the data.
 * The top-level band dominates zoomed out and fades as deeper bands appear;
 * every sub-level band fades out again as full cards take over. All ramps are
 * continuous functions of zoom — no pop-in. Labels counter-scale to keep a
 * constant screen size. While a selection focus is active they dim to
 * background context: the constellation has left their geography behind.
 */
export function ClusterLabels() {
  const { view: useView, world: useWorld, config } = useCavin()
  // Subscribe to zoom only — positions are world-anchored via the parent
  // `.world` transform, so pan (x/y) changes must not re-render this layer.
  const zoom = useView((s) => s.cam.zoom)
  const zRooms = useView((s) => s.zRooms)
  const zCards = useView((s) => s.zCards)
  const selectedId = useView((s) => s.selectedId)
  const world = useWorld((s) => s.world)
  const dim = focusForSelection(world, selectedId) ? config.edges.focusLabelAlpha : 1
  const inv = 1 / zoom
  // Generic bands sliced from the world: the first band IS the top level,
  // every deeper level plays the sub-cluster band (same ramp).
  const [topBand, ...subBands] = groupsByDepth(world)

  return (
    <>
      {topBand && clusterLevels(0, zoom, zRooms, zCards) > 0.01 &&
        topBand.map((w) => (
          <div
            key={w.id}
            className="world-anchor"
            style={{ transform: `translate(${w.centroid[0]}px, ${w.centroid[1]}px)` }}
          >
            <div
              className="cluster-label-top"
              style={{ opacity: clusterLevels(0, zoom, zRooms, zCards) * 0.95 * dim, color: w.color, borderColor: w.color, transform: `translate(-50%, -50%) scale(${inv})` }}
            >
              {w.name}
              <span className="cluster-count">{w.count}</span>
            </div>
          </div>
        ))}
      {subBands.map((groups, i) => {
        const band = clusterLevels(i + 1, zoom, zRooms, zCards)
        if (band <= 0.01) return null
        return groups.map((r) => (
          <div
            key={r.id}
            className="world-anchor"
            style={{ transform: `translate(${r.centroid[0]}px, ${r.centroid[1]}px)` }}
          >
            <div
              className="cluster-label"
              style={{ opacity: band * 0.85 * dim, color: r.color, borderColor: r.color, transform: `translate(-50%, -50%) scale(${inv})` }}
            >
              {r.name}
              <span className="cluster-count">{r.count}</span>
            </div>
          </div>
        ))
      })}
    </>
  )
}
