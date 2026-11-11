import { describe, expect, it } from 'vitest'
import { deriveWorld, indexEdgesByNode } from '@cavin/core'
import type { Camera, CavinNode, SchemaAdapter, WorldEdge } from '@cavin/core'
import { createFrameHolder } from './frame'

/**
 * The frame holder owns the per-frame contract: focus-blend advancement,
 * scene-cache validity, and the viewport. These tests pin the behavior
 * issues #14 fixed — headless, no DOM, no rAF.
 */

const VP = { w: 800, h: 600 }

/** One shared camera object — the cache keys on reference identity. */
const CAM: Camera = { x: 0, y: 0, zoom: 1 }

interface Attrs {
  title: string
  embedding: number[]
}

const testAdapter: SchemaAdapter<Attrs> = {
  noun: 'item',
  labelOf: (n) => n.attributes.title,
  fields: [{ key: 'title', label: 'Title', kind: 'text' }],
  validate: () => null,
  createDefault: () => ({ title: '', embedding: [1, 0] }),
  layoutVectorOf: (n) => n.attributes.embedding,
}

const makeNode = (partial: Partial<CavinNode<Attrs>> & { id: string }): CavinNode<Attrs> => ({
  position: [0, 0],
  groupPath: ['ML', 'Optimizers'],
  attributes: { title: partial.id, embedding: [1, 0] },
  state: {},
  ...partial,
})

function focusedWorld() {
  const world = deriveWorld(
    [makeNode({ id: 'sel' }), makeNode({ id: 'rel', position: [400, 0], groupPath: ['Design', 'X'] })],
    testAdapter,
  )
  // A confirmed edge between the two — focusForSelection needs one.
  const edges: WorldEdge[] = [
    { id: 'e1', from: 'sel', to: 'rel', createdAt: 0, kind: 'confirmed' },
  ]
  return { ...world, edges, edgesByNode: indexEdgesByNode(edges) }
}

describe('createFrameHolder', () => {
  it('hands the same scene back for identical inputs within a frame', () => {
    const frame = createFrameHolder()
    const world = deriveWorld([makeNode({ id: 'a' }), makeNode({ id: 'b' })], testAdapter)
    const s1 = frame.scene(world, CAM, 3, null, VP, 8)
    const s2 = frame.scene(world, CAM, 3, null, VP, 8)
    expect(s2).toBe(s1)
  })

  it('invalidates cached scenes when the focus blend advances', () => {
    const frame = createFrameHolder()
    const world = focusedWorld()
    // No selection — blend stays 0, scene is stable across no-op advances.
    frame.advanceFocus(false)
    const s0 = frame.scene(world, CAM, 3, null, VP, 8)
    frame.advanceFocus(false)
    expect(frame.scene(world, CAM, 3, null, VP, 8)).toBe(s0)

    // Selection with a confirmed edge — the blend moves, so the cached scene
    // is stale even though world/cam/selection/viewport are untouched.
    frame.advanceFocus(true)
    const s1 = frame.scene(world, CAM, 3, 'sel', VP, 8)
    expect(s1).not.toBe(s0)
    expect(s1.focusK).toBeGreaterThan(0)

    // Repeated advances each produce a fresh scene (focusK progressed).
    frame.advanceFocus(true)
    const s2 = frame.scene(world, CAM, 3, 'sel', VP, 8)
    expect(s2).not.toBe(s1)
    expect(s2.focusK).toBeGreaterThan(s1.focusK)
  })

  it('snaps the blend to exactly 1 so the gather terminates', () => {
    const frame = createFrameHolder()
    frame.advanceFocus(true)
    let last = -1
    let guard = 0
    while (frame.focusBlend() < 1 && guard++ < 10_000) {
      last = frame.focusBlend()
      frame.advanceFocus(true)
    }
    expect(frame.focusBlend()).toBe(1)
    expect(last).toBeLessThan(1) // the snap, not the asymptote, reached 1
  })

  it('defocus resets the blend to 0 and invalidates the cache once', () => {
    const frame = createFrameHolder()
    const world = focusedWorld()
    frame.advanceFocus(true)
    frame.scene(world, CAM, 3, 'sel', VP, 8)
    frame.advanceFocus(true)
    const during = frame.scene(world, CAM, 3, 'sel', VP, 8)
    expect(during.focusK).toBeGreaterThan(0)

    frame.advanceFocus(false)
    expect(frame.focusBlend()).toBe(0)
    const after = frame.scene(world, CAM, 3, 'sel', VP, 8)
    expect(after).not.toBe(during)
    expect(after.focusK).toBe(0)
    // No further change — same scene identity on repeat.
    expect(frame.scene(world, CAM, 3, 'sel', VP, 8)).toBe(after)
  })

  it('serves one scene per margin per frame', () => {
    const frame = createFrameHolder()
    const world = deriveWorld([makeNode({ id: 'a' }), makeNode({ id: 'b' })], testAdapter)
    frame.advanceFocus(false)
    const dots = frame.scene(world, CAM, 3, null, VP, 8)
    const labels = frame.scene(world, CAM, 3, null, VP, 60)
    expect(labels).not.toBe(dots)
    expect(frame.scene(world, CAM, 3, null, VP, 8)).toBe(dots)
  })
})
