import { useViewStore } from '../store'

/**
 * The 4th dimension: scrub time. Moving right fades/shrinks older nodes
 * (older than the cutoff), leaving the most recent knowledge bright.
 */
export function DimensionSlider() {
  const timeT = useViewStore((s) => s.timeT)
  const setTimeT = useViewStore((s) => s.setTimeT)

  return (
    <div className="time-slider hud-panel">
      <span className="time-label">time depth</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={timeT}
        onChange={(e) => setTimeT(Number(e.target.value))}
      />
      <span className="time-hint">{timeT === 0 ? 'all eras' : `newest ${(100 - timeT * 100).toFixed(0)}%`}</span>
    </div>
  )
}
