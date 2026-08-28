import { useCavin } from '../context'

/**
 * The 4th dimension: scrub time. Moving right fades/shrinks older items
 * (older than the cutoff), leaving the most recent knowledge bright.
 * Rendered only when the adapter flags a numeric field as the time axis.
 */
export function DimensionSlider() {
  const { adapter, view: useView } = useCavin()
  const timeT = useView((s) => s.timeT)
  const setTimeT = useView((s) => s.setTimeT)
  if (!adapter.fields.some((f) => f.time === true)) return null

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
