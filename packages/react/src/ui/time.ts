import type { SchemaAdapter } from '@cavin/core'
import { timeFieldOf, timeRangeOf } from '@cavin/core'
import type { CavinNode } from '@cavin/core'

/**
 * Time-axis presentation helpers. The slider and dimming only appear when
 * the adapter flags a numeric field as the time axis; the formatting adapts
 * to the data-derived domain (years vs dates).
 */

/** "2015" for sub-3000-unit spans (years), ISO dates for ms epochs. */
export function formatTimeValue(t: number, domain: [number, number]): string {
  const span = domain[1] - domain[0]
  if (span <= 3000) return String(Math.round(t))
  return new Date(t).toISOString().slice(0, 10)
}

/** The resolved time domain of a world, or null without a time axis. */
export function timeDomainOf<TAttr>(
  nodes: CavinNode<TAttr>[],
  adapter: SchemaAdapter<TAttr>,
): [number, number] | null {
  return timeFieldOf(adapter) ? timeRangeOf(nodes, adapter) : null
}
