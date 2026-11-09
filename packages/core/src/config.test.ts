import { describe, expect, it } from 'vitest'
import { mergeConfig, layoutConfig } from './config'
import { deriveWorld } from './layout'
import { chipOpacity, revealZoom, roomRadius } from './lod'
import { suggestEdges } from './edges'
import { makeNode, testAdapter } from './test-helpers'

/**
 * The per-instance config contract (issue #2): `CavinCanvas config={…}`
 * deep-merges over the defaults and the RESULT must reach every render-time
 * computation — not just the derive. These tests pin the seam: a non-default
 * config changes room radii, LOD ramps, cluster colours AND the suggestion
 * policy, where before only ~10 of 75 fields were ever consulted.
 */

describe('mergeConfig threading', () => {
  it('a room override reaches the room-radius render computation', () => {
    const cfg = mergeConfig(layoutConfig, { room: { radiusMin: 500 } })
    expect(roomRadius(1, 1, cfg)).toBe(500)
    // Default unchanged — per-instance, not global.
    expect(roomRadius(1, 1)).toBe(layoutConfig.room.radiusMin)
  })

  it('a lod override reaches the chip-opacity and reveal-zoom ramps', () => {
    const cfg = mergeConfig(layoutConfig, {
      lod: { chipFadeStart: 2, chipFadeFull: 4, revealBase: 3 },
    })
    const zRooms = layoutConfig.lod.zRooms
    // Same zoom, different config → different opacity / reveal zoom.
    expect(chipOpacity(zRooms, zRooms, cfg)).not.toBe(chipOpacity(zRooms, zRooms))
    expect(revealZoom(2, layoutConfig.lod.zCards, cfg)).not.toBe(
      revealZoom(2, layoutConfig.lod.zCards),
    )
  })

  it('a layout colour override reaches derived cluster colours', () => {
    const nodes = [
      makeNode({ id: 'a', groupPath: ['Wing'], position: [0, 0] }),
      makeNode({ id: 'b', groupPath: ['Wing'], position: [10, 0] }),
    ]
    const base = deriveWorld(nodes, testAdapter)
    const cfg = mergeConfig(layoutConfig, { layout: { hueOffset: 200 } })
    const tinted = deriveWorld(nodes, testAdapter, undefined, [], cfg)
    expect(tinted.groups[0].color).not.toBe(base.groups[0].color)
  })

  it('config.edges reaches suggestEdges through a merged config', () => {
    const node = (id: string, group: string, embedding: number[]) =>
      makeNode({ id, groupPath: [group], position: [0, 0], attributes: { title: id, embedding } })
    const nodes = [
      node('a', 'X', [1, 0]),
      node('b', 'Y', [0.9, 0.1]),
      node('c', 'X', [0, 1]),
      node('d', 'Y', [0.1, 0.9]),
    ]
    const vec = (n: (typeof nodes)[number]) => n.attributes.embedding
    const domain = (n: (typeof nodes)[number]) => n.groupPath[0] ?? ''
    const permissive = mergeConfig(layoutConfig, { edges: { simThreshold: 0.5 } })
    const impossible = mergeConfig(layoutConfig, { edges: { simThreshold: 1.1 } })
    const loose = suggestEdges(nodes, domain, vec, permissive.edges)
    const tight = suggestEdges(nodes, domain, vec, impossible.edges)
    expect(loose.length).toBeGreaterThan(0)
    expect(tight).toHaveLength(0)
  })
})
