/**
 * Shared easing / time math. Kept dependency-free so every module (derive,
 * lod, presentation) can import it without pulling in layout semantics.
 */

/** smoothstep(a, b, x) */
export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Time-dimension factor in [0,1]: at timeT=0 everything is bright; as the
 * slider moves right, nodes older than the cutoff dim/shrink away (older =
 * dimmer). The domain is data-derived — `timeRangeOf` over the adapter's
 * time-axis field — never module-load time.
 */
export function timeFactor(t: number, range: [number, number], timeT: number): number {
  const [min, max] = range
  const cutoff = min + timeT * (max - min)
  const ramp = 0.12 * (max - min)
  return smoothstep(cutoff, cutoff + ramp, t)
}
