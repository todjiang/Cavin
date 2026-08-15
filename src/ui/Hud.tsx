import { useRef, useState } from 'react'
import { useViewStore } from '../store'
import { useWorldStore } from '../store/world'
import { DimensionSlider } from './DimensionSlider'

export function Hud() {
  const zoom = useViewStore((s) => s.cam.zoom)
  const zRooms = useViewStore((s) => s.zRooms)
  const zCards = useViewStore((s) => s.zCards)
  const setZRooms = useViewStore((s) => s.setZRooms)
  const setZCards = useViewStore((s) => s.setZCards)
  const breadcrumb = useViewStore((s) => s.breadcrumb)
  const world = useWorldStore((s) => s.world)
  const addNode = useWorldStore((s) => s.addNode)
  const resetDemo = useWorldStore((s) => s.resetDemo)

  // Two-step confirm for the destructive reset: first click arms, second fires.
  const [arming, setArming] = useState(false)
  const armTimer = useRef<number | undefined>(undefined)
  const onReset = () => {
    if (!arming) {
      setArming(true)
      armTimer.current = window.setTimeout(() => setArming(false), 3000)
      return
    }
    window.clearTimeout(armTimer.current)
    setArming(false)
    resetDemo()
  }

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-panel">
          <div className="hud-title">CAVIN · memory palace</div>
          <div className="hud-breadcrumb">{breadcrumb || '—'}</div>
          <div className="hud-counts">
            {world.nodes.length} notes · {world.rooms.length} rooms · {world.wings.length} wings ·
            zoom {(zoom * 100).toFixed(0)}%
          </div>
          <div className="hud-actions">
            <button
              className="hud-button"
              title="New note at the viewport center (N)"
              onClick={() => {
                const { cam } = useViewStore.getState()
                addNode([cam.x, cam.y])
              }}
            >
              ＋ new note
            </button>
            <button
              className={`hud-button${arming ? ' danger' : ''}`}
              title="Clear saved edits and restore the seeded demo palace"
              onClick={onReset}
            >
              {arming ? 'reset — sure?' : 'reset demo'}
            </button>
          </div>
          <label className="hud-slider">
            <span>room labels @ zoom ≥ {zRooms.toFixed(2)}</span>
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.01}
              value={zRooms}
              onChange={(e) => setZRooms(Number(e.target.value))}
            />
          </label>
          <label className="hud-slider">
            <span>child labels @ zoom ≥ {zCards.toFixed(2)}</span>
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.01}
              value={zCards}
              onChange={(e) => setZCards(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="hud-help">
          drag to pan · wheel to zoom
          <br />
          click node for details · drag label to move
          <br />
          double-click to edit · wheel zoom opens deeper levels
          <br />
          N new note · C new child · L lock · Del delete
        </div>
      </div>
      <DimensionSlider />
    </div>
  )
}
