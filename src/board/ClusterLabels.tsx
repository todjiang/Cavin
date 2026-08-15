import { useViewStore } from '../store'
import { useWorldStore } from '../store/world'
import { lodLevels } from './lod'

/**
 * DOM wing/room name labels. Wing labels dominate zoomed out and fade as room
 * labels appear; room labels fade out again as full cards take over. All ramps
 * are continuous functions of zoom — no pop-in. Labels counter-scale to keep a
 * constant screen size.
 */
export function ClusterLabels() {
  // Subscribe to zoom only — positions are world-anchored via the parent
  // `.world` transform, so pan (x/y) changes must not re-render this layer.
  const zoom = useViewStore((s) => s.cam.zoom)
  const zRooms = useViewStore((s) => s.zRooms)
  const zCards = useViewStore((s) => s.zCards)
  const world = useWorldStore((s) => s.world)
  const lv = lodLevels(zoom, zRooms, zCards)
  const inv = 1 / zoom

  return (
    <>
      {lv.wings > 0.01 &&
        world.wings.map((w) => (
          <div
            key={w.id}
            className="world-anchor"
            style={{ transform: `translate(${w.centroid[0]}px, ${w.centroid[1]}px)` }}
          >
            <div
              className="wing-label"
              style={{ opacity: lv.wings * 0.95, color: w.color, borderColor: w.color, transform: `translate(-50%, -50%) scale(${inv})` }}
            >
              {w.name}
              <span className="cluster-count">{w.count}</span>
            </div>
          </div>
        ))}
      {lv.rooms > 0.01 &&
        world.rooms.map((r) => (
          <div
            key={r.id}
            className="world-anchor"
            style={{ transform: `translate(${r.centroid[0]}px, ${r.centroid[1]}px)` }}
          >
            <div
              className="cluster-label"
              style={{ opacity: lv.rooms * 0.85, color: r.color, borderColor: r.color, transform: `translate(-50%, -50%) scale(${inv})` }}
            >
              {r.name}
              <span className="cluster-count">{r.count}</span>
            </div>
          </div>
        ))}
    </>
  )
}
