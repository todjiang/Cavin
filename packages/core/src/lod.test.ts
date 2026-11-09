import { describe, expect, it } from 'vitest'
import {
  chipOpacity,
  clusterLevels,
  focusFalloff,
  focusRingTargets,
  lodLevels,
  revealZoom,
  roomMorph,
  roomRadius,
  roomRadiusEase,
  roomSlot,
  visibleNodes,
  zoomGate,
} from './lod'
import type { Camera, SelectionFocus } from './types'
import { layoutConfig, mergeConfig } from './config'
import { deriveWorld } from './layout'
import { family, makeNode, testAdapter } from './test-helpers'

/**
 * lod.ts is the deepest module in the core — the zoom-driven room morph,
 * the visibility pruning, the focus constellation. One test per export,
 * headless, pinning the ramps and the culling contract the render layers
 * rely on.
 */

const cam = (x = 0, y = 0, zoom = 1): Camera => ({ x, y, zoom })
const world = () => deriveWorld(family(), testAdapter)

describe('clusterLevels', () => {
  it('depth 0 dominates zoomed out and yields to deeper bands', () => {
    expect(clusterLevels(0, 0.5, 2, 6)).toBeGreaterThan(0.9)
    expect(clusterLevels(0, 2.8, 2, 6)).toBeLessThan(0.1)
    // Depth ≥ 1 ramps in across the room zoom and out at card zoom.
    expect(clusterLevels(1, 1.0, 2, 6)).toBeLessThan(0.05)
    expect(clusterLevels(1, 2.0, 2, 6)).toBeGreaterThan(0.5)
    expect(clusterLevels(1, 6.6, 2, 6)).toBeLessThan(0.1)
  })
})

describe('lodLevels', () => {
  it('blobs fade out and dots fade in as you zoom toward the rooms', () => {
    const out = lodLevels(0.5, 2, 6)
    const mid = lodLevels(2.2, 2, 6)
    const deep = lodLevels(6.5, 2, 6)
    expect(out.blobs).toBeGreaterThan(0.5)
    expect(out.dots).toBeLessThan(0.2)
    expect(mid.dots).toBeGreaterThan(0.5)
    expect(deep.blobs).toBeLessThan(0.1)
    expect(deep.dots).toBe(1) // permanent once revealed
  })
})

describe('chipOpacity', () => {
  it('ramps between the configured fade points', () => {
    const cfg = layoutConfig
    const lo = cfg.lod.chipFadeStart * 2
    const hi = cfg.lod.chipFadeFull * 2 * 1.2
    expect(chipOpacity(lo, 2, cfg)).toBeLessThan(0.05)
    expect(chipOpacity(hi, 2, cfg)).toBeGreaterThan(0.9)
  })
})

describe('revealZoom', () => {
  it('scales with depth and saturates at the configured depth', () => {
    const z = revealZoom(1, 6, layoutConfig)
    expect(z).toBeCloseTo(6 * layoutConfig.lod.revealBase)
    const d5 = revealZoom(5, 6, layoutConfig)
    const d9 = revealZoom(9, 6, layoutConfig)
    expect(d5).toBeLessThan(d9)
    // Saturated: depth 7 needs no more zoom than depth 6.
    expect(revealZoom(7, 6, layoutConfig)).toBe(revealZoom(6, 6, layoutConfig))
  })
})

describe('zoomGate', () => {
  it('is a smooth 0→1 gate across the reveal threshold', () => {
    const cfg = layoutConfig
    const lo = revealZoom(2, 6, cfg)
    expect(zoomGate(2, lo * 0.5, 6, cfg)).toBe(0)
    expect(zoomGate(2, lo * cfg.lod.gateRamp * 1.5, 6, cfg)).toBe(1)
    const mid = zoomGate(2, lo * (1 + cfg.lod.gateRamp) * 0.5, 6, cfg)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })
})

describe('focusFalloff', () => {
  it('is 1 inside the radius, 0 outside 1.6×, smooth between', () => {
    const r = layoutConfig.lod.focusRadius
    expect(focusFalloff(0)).toBe(1)
    expect(focusFalloff(r * r)).toBe(1)
    expect(focusFalloff((r * 2) ** 2)).toBe(0)
    const mid = focusFalloff((r * 1.3) ** 2)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })
})

describe('roomRadius', () => {
  it('scales with sqrt(childCount), floored at the minimum, constant screen size', () => {
    const cfg = layoutConfig
    const one = roomRadius(1, 1, cfg)
    const four = roomRadius(4, 1, cfg)
    expect(one).toBeCloseTo(Math.max(cfg.room.radiusMin, cfg.room.radiusPerChild))
    expect(four).toBeCloseTo(Math.max(cfg.room.radiusMin, cfg.room.radiusPerChild * 2))
    expect(roomRadius(0, 2, cfg)).toBeCloseTo(cfg.room.radiusMin / 2)
    // Constant screen size: doubling the zoom halves the world radius.
    expect(roomRadius(4, 2, cfg)).toBeCloseTo(four / 2)
  })
})

describe('roomSlot', () => {
  it('places children on a ring, first slot at the top, deterministic jitter', () => {
    const cfg = layoutConfig
    const [x, y] = roomSlot(0, 4, [100, 100], 50, 0, cfg)
    expect(x).toBeCloseTo(100)
    expect(y).toBeCloseTo(100 - 50 * cfg.room.ringFraction)
    // Ring radius honors the configured fraction of the room radius
    // (slot 1 of 4 sits at angle 0 — straight right of the center).
    const [x2] = roomSlot(1, 4, [0, 0], 40, 0, cfg)
    expect(Math.abs(x2)).toBeCloseTo(40 * cfg.room.ringFraction)
    // Jitter is deterministic per id.
    const j1 = roomSlot(0, 4, [0, 0], 50, 0.1, cfg)
    const j2 = roomSlot(0, 4, [0, 0], 50, 0.1, cfg)
    expect(j1).toEqual(j2)
  })
})

describe('roomRadiusEase', () => {
  it('eases from the configured minimum to the full radius', () => {
    const cfg = layoutConfig
    expect(roomRadiusEase(0, cfg)).toBeCloseTo(cfg.room.radiusEaseMin)
    expect(roomRadiusEase(1, cfg)).toBe(1)
    const mid = roomRadiusEase(0.5, cfg)
    expect(mid).toBeGreaterThan(cfg.room.radiusEaseMin)
    expect(mid).toBeLessThan(1)
  })
})

describe('focusRingTargets', () => {
  const focus: SelectionFocus = {
    id: 'a',
    nodeIds: new Set(['a', 'b', 'd']),
    edgeIds: new Set(['e0']),
    ringIds: new Set(['d']),
    childIds: ['b'],
  }

  it('lays children on the inner ring and relations on the outer, deterministically', () => {
    const w = world()
    const t1 = focusRingTargets(w, focus, [0, 0], 1, layoutConfig)
    const t2 = focusRingTargets(w, focus, [0, 0], 1, layoutConfig)
    expect([...t1.keys()].sort()).toEqual(['b', 'd'])
    expect(t1.get('b')).toEqual(t2.get('b'))
    expect(t1.get('d')).toEqual(t2.get('d'))
    // Inner ring sits closer than the outer ring.
    const inner = Math.hypot(t1.get('b')![0], t1.get('b')![1])
    const outer = Math.hypot(t1.get('d')![0], t1.get('d')![1])
    expect(inner).toBeLessThan(outer)
    // Constant screen size: zoom 2 halves the world-space radii.
    const t3 = focusRingTargets(w, focus, [0, 0], 2, layoutConfig)
    expect(Math.hypot(t3.get('d')![0], t3.get('d')![1])).toBeCloseTo(outer / 2)
  })
})

describe('roomMorph', () => {
  it('keeps placed nodes exactly at their position', () => {
    const w = world()
    const d = w.nodeById.get('d')! // root, unplaced
    const m = roomMorph(w, d, 1, cam(), 6, new Map(), layoutConfig)
    expect(m.pos).toEqual(d.position)
    expect(m.open).toBe(1)
    expect(m.roomOpen).toBe(0) // zoom 1 ≪ reveal zoom for its children
  })

  it('morphs an unplaced child toward the ring as the parent room opens', () => {
    const w = world()
    const b = w.nodeById.get('b')! // child of a
    const closed = roomMorph(w, b, 1, cam(100, 100), 6, new Map(), layoutConfig)
    expect(closed.pos).toEqual(b.position) // huddled at the stored position
    // Zoom deep past the reveal gate with the camera centered on the family.
    const zoomed = 6 * layoutConfig.lod.revealBase * layoutConfig.lod.gateRamp * 2
    const open = roomMorph(w, b, zoomed, cam(100, 100), 6, new Map(), layoutConfig)
    expect(open.open).toBeGreaterThan(0.5)
    expect(open.pos).not.toEqual(closed.pos)
  })

  it('reuses cache entries within one frame and never mutates the world', () => {
    const w = world()
    const cache = new Map()
    const b = w.nodeById.get('b')!
    const m1 = roomMorph(w, b, 1, cam(100, 100), 6, cache, layoutConfig)
    const m2 = roomMorph(w, w.nodeById.get('a')!, 1, cam(100, 100), 6, cache, layoutConfig)
    expect(roomMorph(w, b, 1, cam(100, 100), 6, cache, layoutConfig)).toBe(m1)
    // The parent's morph is cached from computing the child's chain.
    expect(cache.get('a')).toBe(m2)
    expect(w.nodeById.get('b')!.position).toEqual(b.position)
  })
})

describe('visibleNodes', () => {
  it('culls off-screen nodes and prunes closed off-screen subtrees', () => {
    const w = deriveWorld(
      [
        makeNode({ id: 'on', position: [0, 0] }),
        makeNode({ id: 'off', position: [100_000, 0] }),
        makeNode({ id: 'kid', parentId: 'off', position: [100_000, 0] }),
      ],
      testAdapter,
    )
    const vis = visibleNodes(w, cam(), 800, 600, 6, 8, new Map(), layoutConfig)
    const ids = vis.map((v) => v.node.id)
    expect(ids).toContain('on')
    expect(ids).not.toContain('off')
    expect(ids).not.toContain('kid') // whole subtree pruned, not walked
  })

  it('includes free-placed nodes regardless of their parent’s screen position', () => {
    const w = deriveWorld(
      [
        makeNode({ id: 'p', position: [100_000, 0] }),
        makeNode({ id: 'near-child', parentId: 'p', position: [0, 0], state: { placed: true } }),
      ],
      testAdapter,
    )
    const vis = visibleNodes(w, cam(), 800, 600, 6, 8, new Map(), layoutConfig)
    expect(vis.map((v) => v.node.id)).toContain('near-child')
  })

  it('projects entries through the shared formula and honors the margin', () => {
    const w = world()
    const tight = visibleNodes(w, cam(), 800, 600, 6, 8, new Map(), layoutConfig)
    const a = tight.find((v) => v.node.id === 'a')! // at (100,100)
    expect(a.sx).toBeCloseTo(400 + 100)
    expect(a.sy).toBeCloseTo(300 + 100)
    // 'd' at (900,900) is inside the viewport but outside margin 8? No:
    // it's off-screen; margin decides whether its subtree extent reaches in.
    const wide = visibleNodes(w, cam(), 800, 600, 6, 500, new Map(), layoutConfig)
    expect(wide.length).toBeGreaterThanOrEqual(tight.length)
  })
})

describe('lod config overrides', () => {
  it('a host config moves the ramps', () => {
    const cfg = mergeConfig(layoutConfig, {
      lod: { chipFadeStart: 0.1, chipFadeFull: 0.2, revealBase: layoutConfig.lod.revealBase * 2 },
    })
    // With fade points pulled in, the same zoom is past full opacity.
    expect(chipOpacity(2.2, 2, cfg)).toBeGreaterThan(chipOpacity(2.2, 2, layoutConfig))
    const z = revealZoom(1, 6, cfg)
    expect(z).toBeCloseTo(revealZoom(1, 6, layoutConfig) * 2)
  })
})
