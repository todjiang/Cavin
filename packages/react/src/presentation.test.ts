import { describe, expect, it } from 'vitest'
import type { CavinNode } from '@cavin/core'
import { deriveWorld, layoutConfig } from '@cavin/core'
import { buildPalette, paletteMemo } from './presentation'
import { formatTimeValue, timeDomainOf } from './ui/time'

/**
 * The pure presentation helpers — palette construction/memoization and the
 * time-axis formatting — tested without React and without DOM.
 */

interface Attrs {
  title: string
  year: number
}

const timedAdapter = {
  noun: 'item',
  labelOf: (n: CavinNode<Attrs>) => n.attributes.title,
  fields: [
    { key: 'title' as const, label: 'Title', kind: 'text' as const },
    { key: 'year' as const, label: 'Year', kind: 'number' as const, time: true },
  ],
  validate: () => null,
  createDefault: (): Attrs => ({ title: '', year: 2000 }),
}

const plainAdapter = { ...timedAdapter, fields: timedAdapter.fields.slice(0, 1) }

const nodes: CavinNode<Attrs>[] = [
  { id: 'a', position: [0, 0], groupPath: ['X'], attributes: { title: 'a', year: 2010 }, state: {} },
  { id: 'b', position: [1, 0], groupPath: ['Y'], attributes: { title: 'b', year: 2020 }, state: {} },
  { id: 'c', position: [2, 0], groupPath: ['X'], attributes: { title: 'c', year: 2015 }, state: {} },
]

describe('buildPalette', () => {
  it('maps node colors by top-level group and cluster hues directly', () => {
    const world = deriveWorld(nodes, timedAdapter)
    const p = buildPalette(timedAdapter, world, layoutConfig)
    expect(p.nodeColor(nodes[0])).toBe(p.nodeColor(nodes[2])) // same group
    expect(p.nodeColor(nodes[0])).not.toBe(p.nodeColor(nodes[1]))
    const cluster = world.groups.find((g) => g.depth === 0 && g.path[0] === 'X')!
    expect(p.clusterHue(cluster)).toBe(cluster.hue)
    // Hue accessor agrees with the color's group.
    expect(p.nodeHue(nodes[1])).toBeGreaterThanOrEqual(0)
  })

  it('timeDim follows the time axis; 1 when the adapter declares none', () => {
    const world = deriveWorld(nodes, timedAdapter)
    const p = buildPalette(timedAdapter, world, layoutConfig)
    // Mid-range node: bright at the start of the sweep, dimmed past it.
    expect(p.timeDim(nodes[2], 0)).toBe(1)
    expect(p.timeDim(nodes[2], 1)).toBe(0)
    // At mid-sweep the newer node stays brighter than the older one.
    expect(p.timeDim(nodes[1], 0.5)).toBeGreaterThan(p.timeDim(nodes[0], 0.5))
    const p2 = buildPalette(plainAdapter, deriveWorld(nodes, plainAdapter), layoutConfig)
    expect(p2.timeDim(nodes[0], 0)).toBe(1)
  })
})

describe('paletteMemo', () => {
  it('reuses the palette while groups are identity-stable, rebuilds on structural derive', () => {
    const world = deriveWorld(nodes, timedAdapter)
    const memo = paletteMemo(timedAdapter, layoutConfig)
    const first = memo(world)
    expect(memo(world)).toBe(first)
    // A drag frame mints a fresh World but keeps the same groups array.
    const dragged: typeof world = { ...world, nodes: world.nodes.map((n) => n) }
    expect(memo(dragged)).toBe(first)
    // A structural change (new node → re-derived groups) rebuilds.
    const grown = deriveWorld(
      [...nodes, { id: 'd', position: [3, 0], groupPath: ['Z'], attributes: { title: 'd', year: 2024 }, state: {} }],
      timedAdapter,
    )
    expect(memo(grown)).not.toBe(first)
  })
})

describe('time helpers', () => {
  it('formats years for small spans and ISO dates for epochs', () => {
    expect(formatTimeValue(2015.4, [2010, 2020])).toBe('2015')
    expect(formatTimeValue(1700000000000, [1600000000000, 1700000000000])).toBe('2023-11-14')
  })

  it('resolves the world time domain only when the adapter declares a time axis', () => {
    expect(timeDomainOf(nodes, timedAdapter)).toEqual([2010, 2020])
    expect(timeDomainOf(nodes, plainAdapter)).toBeNull()
  })
})
