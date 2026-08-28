import { describe, expect, it } from 'vitest'
import { runAdapterConformance } from '@cavin/core'
import { sanguoAdapter } from './adapter'
import { generateSanguoNodes } from './generate'
import { buildSanguoWorld } from './app-data'

describe('sanguoAdapter conformance', () => {
  it('passes the @cavin/core/testing suite', () => {
    const nodes = generateSanguoNodes()
    const result = runAdapterConformance(sanguoAdapter, {
      valid: nodes.slice(0, 10),
      malformed: [null, undefined, 'x', {}, { id: 'x' }, { id: 'x', attributes: { name: '曹' } }],
    })
    expect(result.failures).toEqual([])
  })

  it('the built world derives with labels everywhere and confirmed relations', () => {
    const { nodes, confirmedEdges } = buildSanguoWorld()
    expect(nodes.length).toBeGreaterThan(0)
    expect(confirmedEdges.length).toBeGreaterThan(0)
    const untitled = nodes.filter((n) => sanguoAdapter.labelOf(n) === '')
    expect(untitled).toEqual([])
  })
})

describe('sanguo fresh-node suggestion contract', () => {
  it('a brand-new person attracts zero machine-suggested connections', async () => {
    const { applyCommand, deriveWorld } = await import('@cavin/core')
    const { nodes, confirmedEdges } = buildSanguoWorld()
    const world = deriveWorld(nodes, sanguoAdapter, undefined, confirmedEdges)
    const res = applyCommand(world, { type: 'add', at: [0, 0] }, sanguoAdapter)
    const id = res.createdId!
    // The panel lists connections from edgesByNode — it must be confirmed
    // edges only (none for a fresh node), never machine suggestions.
    const edges = res.world!.edgesByNode.get(id) ?? []
    expect(edges).toEqual([])
    // ...and no existing person gains a ghost row pointing at the new one.
    let ghosts = 0
    for (const [nid, list] of res.world!.edgesByNode) {
      if (nid === id) continue
      if (list.some((e) => e.kind === 'suggested' && (e.from === id || e.to === id))) ghosts++
    }
    expect(ghosts).toBe(0)
  })
})
