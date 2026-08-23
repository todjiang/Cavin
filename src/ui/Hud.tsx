import { useRef, useState } from 'react'
import { useViewStore } from '../store'
import { useWorldStore } from '../store/world'
import { DEMO_DATASETS } from '../demo/datasets'
import { DimensionSlider } from './DimensionSlider'

export function Hud() {
  const zoom = useViewStore((s) => s.cam.zoom)
  const zRooms = useViewStore((s) => s.zRooms)
  const zCards = useViewStore((s) => s.zCards)
  const setZRooms = useViewStore((s) => s.setZRooms)
  const setZCards = useViewStore((s) => s.setZCards)
  const labelFont = useViewStore((s) => s.labelFont)
  const setLabelFont = useViewStore((s) => s.setLabelFont)
  const breadcrumb = useViewStore((s) => s.breadcrumb)
  const world = useWorldStore((s) => s.world)
  const addNode = useWorldStore((s) => s.addNode)
  const resetDemo = useWorldStore((s) => s.resetDemo)
  const datasetId = useWorldStore((s) => s.datasetId)
  const loadDataset = useWorldStore((s) => s.loadDataset)

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

  // Dataset switch: same two-step arm as reset — switching discards the
  // current world's edits, so a stray select change must not fire it.
  const [pendingDataset, setPendingDataset] = useState<string | null>(null)
  const datasetTimer = useRef<number | undefined>(undefined)
  const armDatasetSwitch = (id: string) => {
    window.clearTimeout(datasetTimer.current)
    setPendingDataset(id)
    datasetTimer.current = window.setTimeout(() => setPendingDataset(null), 3000)
  }
  const confirmDatasetSwitch = () => {
    window.clearTimeout(datasetTimer.current)
    if (pendingDataset) loadDataset(pendingDataset)
    setPendingDataset(null)
  }
  const pendingLabel = DEMO_DATASETS.find((d) => d.id === pendingDataset)?.label

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
            <select
              className="hud-select"
              title="Demo dataset — switching discards edits to the current one"
              value={pendingDataset ?? datasetId}
              onChange={(e) => {
                if (e.target.value === datasetId) setPendingDataset(null)
                else armDatasetSwitch(e.target.value)
              }}
            >
              {DEMO_DATASETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            {pendingDataset && (
              <button className="hud-button danger" onClick={confirmDatasetSwitch}>
                switch to {pendingLabel} — sure?
              </button>
            )}
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
          N new note · C new child · L lock · Del delete
        </div>
      </div>
      <DimensionSlider />
    </div>
  )
}
