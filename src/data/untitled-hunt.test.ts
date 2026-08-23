import { describe, expect, it } from 'vitest'
import { deriveWorld, layoutNodes } from './layout'
import type { LaidOutNode, World } from './layout'
import { knowledgeAdapter } from '../demo/adapter'
import { labelOf } from '../core/accessors'
import { generateNodes } from '../../examples/machine-learning/generate'
import { buildLegacySanguoNodes } from '../../examples/sanguo/preview/seed'
import { generateSanguoEdges } from '../../examples/sanguo/src/relations'

/** Every connection row the detail panel could render: (node, other) pairs. */
function connectionLabels(world: World): { nodeId: string; otherLabel: string }[] {
  const out: { nodeId: string; otherLabel: string }[] = []
  for (const n of world.nodes) {
    for (const e of world.edgesByNode.get(n.id) ?? []) {
      const other = world.nodeById.get(e.from === n.id ? e.to : e.from)
      out.push({
        nodeId: n.id,
        otherLabel: other ? labelOf(knowledgeAdapter, other) : '<missing>',
      })
    }
  }
  return out
}

describe('untitled-node hunt', () => {
  it('memory-palace fresh seed has no empty/untitled labels', () => {
    const world = deriveWorld(layoutNodes(generateNodes()))
    const untitled = world.nodes.filter((n) => labelOf(knowledgeAdapter, n) === 'Untitled note')
    expect(world.nodes.length).toBeGreaterThan(0)
    expect(untitled.map((n) => n.id)).toEqual([])
  })

  it('sanguo dataset has no empty/untitled labels', () => {
    const world = deriveWorld(buildLegacySanguoNodes() as LaidOutNode[])
    const untitled = world.nodes.filter((n) => labelOf(knowledgeAdapter, n) === 'Untitled note')
    expect(world.nodes.length).toBeGreaterThan(0)
    expect(untitled.map((n) => n.id)).toEqual([])
  })

  it('no connection row renders as "Untitled note" or a missing node (memory palace)', () => {
    const world = deriveWorld(layoutNodes(generateNodes()))
    const bad = connectionLabels(world).filter(
      (c) => c.otherLabel === 'Untitled note' || c.otherLabel === '<missing>',
    )
    expect(world.edges.length).toBeGreaterThan(0) // the dataset does suggest edges
    expect(bad).toEqual([])
  })

  it('no connection row renders as "Untitled note" or a missing node (sanguo, with confirmed edges)', () => {
    const world = deriveWorld(
      buildLegacySanguoNodes() as LaidOutNode[],
      undefined,
      generateSanguoEdges(),
    )
    const bad = connectionLabels(world).filter(
      (c) => c.otherLabel === 'Untitled note' || c.otherLabel === '<missing>',
    )
    expect(world.edges.length).toBeGreaterThan(0)
    expect(bad).toEqual([])
  })
})

