import { describe, expect, it } from 'vitest'
import { deriveScene } from './scene'
import type { Camera, CavinNode, World } from './types'
import { layoutConfig, mergeConfig } from './config'
import { applyCommand } from './commands'
import { indexEdgesByNode } from './edges'
import { deriveWorld } from './layout'
import { makeNode, testAdapter } from './test-helpers'
import type { TestAttrs } from './test-helpers'

/**
 * The Scene is the pure projection layer: (world, camera, viewport, zCards,
 * selectedId, focusBlend, margin) → paintable screen entities. These tests
 * pin the contract the render layers rely on — headless, no DOM, no clock.
 */

const cam = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom })
const VP = { w: 800, h: 600 }

function worldOf(
  nodes: CavinNode<TestAttrs>[],
  confirmedEdges: { from: string; to: string }[] = [],
): World<TestAttrs> {
  const world = deriveWorld(nodes, testAdapter)
  const edges = confirmedEdges.map((e, i) => ({
    id: `e${i}`,
    from: e.from,
    to: e.to,
    createdAt: 0,
    kind: 'confirmed' as const,
    pairKey: `${e.from}|${e.to}`,
  }))
  return { ...world, edges, edgesByNode: indexEdgesByNode(edges) }
}

describe('deriveScene', () => {
  it('projects entries through the one shared formula', () => {
    const world = worldOf([makeNode({ id: 'a', position: [100, 50] }), makeNode({ id: 'b', position: [500, 400] })])
    const scene = deriveScene({
      world,
      cam: cam(0, 0, 1),
      viewport: VP,
      zCards: 3,
      selectedId: null,
      focusBlend: 0,
      margin: 8,
    })
    const a = scene.entries.find((e) => e.node.id === 'a')!
    // w/2 + (x - cam.x) * zoom — the only place this formula may live.
    expect(a.sx).toBe(400 + 100)
    expect(a.sy).toBe(300 + 50)
    // project() agrees with the entry positions.
    expect(scene.project(100, 50)).toEqual([a.sx, a.sy])
    expect(scene.project(0, 0)).toEqual([400, 300])
  })

  it('is deterministic: same inputs derive an identical scene', () => {
    const world = worldOf([makeNode({ id: 'a', position: [100, 50] }), makeNode({ id: 'b', position: [500, 400] })])
    const params = {
      world,
      cam: cam(10, -20, 2),
      viewport: VP,
      zCards: 3,
      selectedId: null,
      focusBlend: 0.4,
      margin: 8,
    }
    const s1 = deriveScene(params)
    const s2 = deriveScene(params)
    expect(s1.entries.map((e) => [e.node.id, e.sx, e.sy])).toEqual(
      s2.entries.map((e) => [e.node.id, e.sx, e.sy]),
    )
    expect(s1.focusK).toBe(s2.focusK)
    expect([...s1.morphs.keys()]).toEqual([...s2.morphs.keys()])
  })

  it('pulls off-screen constellation members into entries under focus', () => {
    // 'rel' sits far outside the viewport but is a confirmed neighbor of
    // the selected node — the focus ring must be able to fly it in.
    const world = worldOf(
      [makeNode({ id: 'sel', position: [0, 0] }), makeNode({ id: 'rel', position: [100_000, 100_000] })],
      [{ from: 'sel', to: 'rel' }],
    )
    const scene = deriveScene({
      world,
      cam: cam(0, 0, 1),
      viewport: VP,
      zCards: 3,
      selectedId: 'sel',
      focusBlend: 1,
      margin: 8,
    })
    expect(scene.focus?.id).toBe('sel')
    const rel = scene.entries.find((e) => e.node.id === 'rel')!
    expect(rel.offscreen).toBe(true)
    // The ring target sits near the focus node, not at the node's far-away
    // home — the display blend converges onto the ring around 'sel'.
    const target = scene.ringTargets.get('rel')!
    expect(Math.hypot(target[0], target[1])).toBeGreaterThan(0)
    expect(Math.hypot(target[0], target[1])).toBeLessThan(10_000)
  })

  it('interpolates display positions with the eased focus blend', () => {
    const world = worldOf(
      [makeNode({ id: 'sel', position: [0, 0] }), makeNode({ id: 'rel', position: [1000, 0] })],
      [{ from: 'sel', to: 'rel' }],
    )
    const params = {
      world,
      cam: cam(0, 0, 1),
      viewport: VP,
      zCards: 3,
      selectedId: 'sel',
      margin: 8,
    }
    const dispX = (focusBlend: number) => {
      const s = deriveScene({ ...params, focusBlend })
      const base = s.morphs.get('rel')!.pos
      const t = s.ringTargets.get('rel')!
      return base[0] + (t[0] - base[0]) * s.focusK
    }
    // Blend 0 → home position; blend 1 → exactly the ring target; the
    // midpoint is eased between them (smoothstep).
    expect(dispX(0)).toBeCloseTo(1000)
    const s1 = deriveScene({ ...params, focusBlend: 1 })
    const targetX = s1.ringTargets.get('rel')![0]
    expect(dispX(1)).toBeCloseTo(targetX)
    expect(dispX(0.5)).toBeGreaterThan(Math.min(1000, targetX))
    expect(dispX(0.5)).toBeLessThan(Math.max(1000, targetX))
    // Without a selection the blend is forced to 0 even when the raw input
    // says 1 — no focus, no constellation.
    const noFocus = deriveScene({ ...params, selectedId: null, focusBlend: 1 })
    expect(noFocus.focusK).toBe(0)
  })

  it('respects the cull margin', () => {
    const world = worldOf([makeNode({ id: 'a', position: [0, 0] }), makeNode({ id: 'far', position: [700, 300] })])
    const base = {
      world,
      cam: cam(0, 0, 1),
      viewport: VP,
      zCards: 3,
      selectedId: null,
      focusBlend: 0,
    }
    // sx('far') = 1100 — outside 800+8 but inside 800+400.
    expect(deriveScene({ ...base, margin: 8 }).entries.some((e) => e.node.id === 'far')).toBe(false)
    expect(deriveScene({ ...base, margin: 400 }).entries.some((e) => e.node.id === 'far')).toBe(true)
  })

  it('shares one morph cache between the visibility walk and the constellation', () => {
    const world = worldOf(
      [
        makeNode({ id: 'sel', position: [0, 0] }),
        makeNode({ id: 'rel1', position: [300, 0] }),
        makeNode({ id: 'rel2', position: [0, 300] }),
        makeNode({ id: 'kid', parentId: 'sel', position: [30, 30] }),
      ],
      [
        { from: 'sel', to: 'rel1' },
        { from: 'sel', to: 'rel2' },
      ],
    )
    const scene = deriveScene({
      world,
      cam: cam(0, 0, 1),
      viewport: VP,
      zCards: 3,
      selectedId: 'sel',
      focusBlend: 1,
      margin: 8,
    })
    // Every entry's morph IS the shared cache's instance — the contract
    // that makes the per-frame allocation cheap and consistent.
    expect(scene.morphs.get('sel')).toBeDefined()
    expect(scene.morphs.get('kid')).toBeDefined()
    for (const e of scene.entries) {
      expect(scene.morphs.get(e.node.id)).toBe(e.morph)
    }
  })

  it('re-derives cleanly over a command-mutated world, honoring a custom config', () => {
    const world1 = worldOf([makeNode({ id: 'a', position: [0, 0] }), makeNode({ id: 'b', position: [100, 0] })])
    const base = {
      cam: cam(0, 0, 1),
      viewport: VP,
      zCards: 3,
      selectedId: null,
      focusBlend: 0,
      margin: 8,
    }
    expect(deriveScene({ ...base, world: world1 }).entries).toHaveLength(2)
    // The scene is a pure function of its inputs: mutate via a command and
    // the new node appears without any renderer state.
    const res = applyCommand(world1, { type: 'add', at: [50, 50] }, testAdapter)
    expect(res.ok).toBe(true)
    if (res.ok && res.world) {
      expect(deriveScene({ ...base, world: res.world }).entries).toHaveLength(3)
    }
    // A host config override flows through deriveScene.
    const cfg = mergeConfig(layoutConfig, { scene: { dotMargin: 500 } })
    const scene = deriveScene({
      ...base,
      world: world1,
      margin: cfg.scene.dotMargin,
      config: cfg,
    })
    expect(scene.entries).toHaveLength(2) // both nodes inside the wide margin
  })
})
