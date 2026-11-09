import { describe, expect, it } from 'vitest'
import type { CavinNode } from './types'
import { clusterLevels } from './lod'
import { deriveWorld } from './layout'
import { groupsByDepth, deepestDepth, leafGroups, nearestGroup, subtree } from './tree'
import { makeNode, testAdapter } from './test-helpers'

/**
 * The depth-generic band contract behind issue #10: renderers slice bands
 * with `groupsByDepth` + `clusterLevels` instead of hardcoding two levels,
 * so a one-level host gets exactly one band and a three-level host gets
 * three. Palace/sanguo are two-level, so their visuals must be unchanged:
 * the two-level defaults are asserted bit-for-bit against the old wings/
 * rooms formulas.
 */

type N = CavinNode<{ title: string; embedding: number[] }>

function at(path: string[], id: string, x: number, y: number): N {
  return makeNode({ id, groupPath: path, position: [x, y] })
}

function threeLevel(): N[] {
  return [
    at(['Camp', 'Role', 'Faction-A'], 'a1', 0, 0),
    at(['Camp', 'Role', 'Faction-A'], 'a2', 10, 0),
    at(['Camp', 'Role', 'Faction-B'], 'b1', 0, 100),
    at(['Camp', 'Supply', 'Depot'], 'c1', 50, 200),
    at(['Field', 'Scout', 'North'], 'd1', 500, 0),
    at(['Field', 'Scout', 'South'], 'e1', 600, 50),
  ]
}

describe('groupsByDepth (render bands)', () => {
  it('buckets a three-level world into three bands', () => {
    const world = deriveWorld(threeLevel(), testAdapter)
    const bands = groupsByDepth(world)
    expect(bands).toHaveLength(3)
    expect(bands[0].map((g) => g.path)).toEqual([['Camp'], ['Field']])
    expect(bands[1].map((g) => g.path)).toEqual([
      ['Camp', 'Role'],
      ['Camp', 'Supply'],
      ['Field', 'Scout'],
    ])
    expect(bands[2].map((g) => g.path)).toEqual([
      ['Camp', 'Role', 'Faction-A'],
      ['Camp', 'Role', 'Faction-B'],
      ['Camp', 'Supply', 'Depot'],
      ['Field', 'Scout', 'North'],
      ['Field', 'Scout', 'South'],
    ])
    // Every group lands in exactly one band.
    expect(bands.flat()).toHaveLength(world.groups.length)
  })

  it('gives a one-level world one band — no phantom sub-level', () => {
    const world = deriveWorld(
      [at(['Tasks'], 't1', 0, 0), at(['Tasks'], 't2', 30, 0)],
      testAdapter,
    )
    const bands = groupsByDepth(world)
    expect(bands).toHaveLength(1)
    expect(bands[0]).toHaveLength(1)
    expect(bands[0][0].path).toEqual(['Tasks'])
  })

  it('is empty for an ungrouped (flat) world', () => {
    const world = deriveWorld(
      [makeNode({ id: 'free', groupPath: [], position: [0, 0] })],
      testAdapter,
    )
    expect(groupsByDepth(world)).toEqual([])
    expect(deepestDepth(world)).toBe(-1)
    expect(leafGroups(world)).toEqual([])
    expect(nearestGroup(world, [0, 0])).toBeNull()
  })
})

describe('clusterLevels (band opacity per depth)', () => {
  const zRooms = 0.15
  const zCards = 0.5
  // The old palace formulas, kept here as the regression oracle.
  const oldWings = (zoom: number) => {
    const t = Math.min(1, Math.max(0, (zoom - zRooms * 0.9) / (zRooms * 1.4 - zRooms * 0.9)))
    return 1 - t * t * (3 - 2 * t)
  }
  const oldRooms = (zoom: number) => {
    const ss = (a: number, b: number) => {
      const t = Math.min(1, Math.max(0, (zoom - a) / (b - a)))
      return t * t * (3 - 2 * t)
    }
    return ss(zRooms * 0.8, zRooms) * (1 - ss(zCards * 0.85, zCards * 1.1))
  }

  it('matches the old wings/rooms ramps bit-for-bit at every zoom (palace parity)', () => {
    for (let zoom = 0.02; zoom <= 2; zoom *= 1.37) {
      expect(clusterLevels(0, zoom, zRooms, zCards)).toBe(oldWings(zoom))
      expect(clusterLevels(1, zoom, zRooms, zCards)).toBe(oldRooms(zoom))
    }
  })

  it('gives every deeper band the sub ramp, so a third level is not silent', () => {
    for (let zoom = 0.02; zoom <= 2; zoom *= 1.5) {
      expect(clusterLevels(2, zoom, zRooms, zCards)).toBe(clusterLevels(1, zoom, zRooms, zCards))
      expect(clusterLevels(3, zoom, zRooms, zCards)).toBe(clusterLevels(1, zoom, zRooms, zCards))
    }
    // Mid-zoom (0.12–0.21 overlap window): all three bands of a 3-level
    // world are live at once.
    const mid = 0.17
    expect(clusterLevels(0, mid, zRooms, zCards)).toBeGreaterThan(0.01)
    expect(clusterLevels(1, mid, zRooms, zCards)).toBeGreaterThan(0.01)
    expect(clusterLevels(2, mid, zRooms, zCards)).toBeGreaterThan(0.01)
  })
})

describe('subtree re-export sanity (tree module cohesion)', () => {
  it('subtree still resolves against a derived three-level world', () => {
    const world = deriveWorld(threeLevel(), testAdapter)
    expect(subtree(world, 'a1').size).toBe(1)
    expect(subtree(world, 'missing')).toEqual(new Set())
  })
})
