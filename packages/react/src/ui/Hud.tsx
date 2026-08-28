import { useRef, useState } from 'react'
import { useCavin } from '../context'
import { DimensionSlider } from './DimensionSlider'

/**
 * Top-left HUD: heading, breadcrumb, live counts, add/reset actions and the
 * LOD/font sliders. Copy is adapter-driven (noun); the counts are generic
 * (nodes · deepest-level groups · top-level groups).
 */
export function Hud() {
  const { adapter, title, view: useView, world: useWorld } = useCavin()
  const zoom = useView((s) => s.cam.zoom)
  const zRooms = useView((s) => s.zRooms)
  const zCards = useView((s) => s.zCards)
  const setZRooms = useView((s) => s.setZRooms)
  const setZCards = useView((s) => s.setZCards)
  const labelFont = useView((s) => s.labelFont)
  const setLabelFont = useView((s) => s.setLabelFont)
  const breadcrumb = useView((s) => s.breadcrumb)
  const world = useWorld((s) => s.world)
  const addNode = useWorld((s) => s.addNode)
  const resetDemo = useWorld((s) => s.resetDemo)

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

  let maxDepth = -1
  for (const g of world.groups) if (g.depth > maxDepth) maxDepth = g.depth
  const topCount = world.groups.filter((g) => g.depth === 0).length
  const leafCount = world.groups.filter((g) => g.depth === maxDepth).length
  const nounPlural = `${adapter.noun}${world.nodes.length === 1 ? '' : 's'}`

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-panel">
          <div className="hud-title">CAVIN{title ? ` · ${title}` : ''}</div>
          <div className="hud-breadcrumb">{breadcrumb || '—'}</div>
          <div className="hud-counts">
            {world.nodes.length} {nounPlural} · {leafCount} groups · {topCount} top ·
            zoom {(zoom * 100).toFixed(0)}%
          </div>
          <div className="hud-actions">
            <button
              className="hud-button"
              title={`New ${adapter.noun} at the viewport center (N)`}
              onClick={() => {
                const { cam } = useView.getState()
                addNode([cam.x, cam.y])
              }}
            >
              ＋ new {adapter.noun}
            </button>
            <button
              className={`hud-button${arming ? ' danger' : ''}`}
              title="Clear saved edits and restore the seeded demo data"
              onClick={onReset}
            >
              {arming ? 'reset — sure?' : 'reset demo'}
            </button>
          </div>
          <label className="hud-slider">
            <span>group labels @ zoom ≥ {zRooms.toFixed(2)}</span>
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
          <label className="hud-slider">
            <span>label font · {labelFont}px</span>
            <input
              type="range"
              min={10}
              max={18}
              step={1}
              value={labelFont}
              onChange={(e) => setLabelFont(Number(e.target.value))}
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
          N new · C new child · L lock · Del delete
        </div>
      </div>
      <DimensionSlider />
    </div>
  )
}
