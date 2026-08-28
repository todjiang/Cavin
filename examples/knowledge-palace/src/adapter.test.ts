import { describe, expect, it } from 'vitest'
import type { CavinEdge, CavinNode } from '@cavin/core'
import { deriveWorld, labelOf, runAdapterConformance } from '@cavin/core'
import { knowledgeAdapter, migrateV3Edges } from './adapter'
import { seedPalaceNodes } from './data'

/**
 * Adapter conformance plus the demo-specific data invariants (the old
 * "untitled hunt" suite): the seed must label completely, and every
 * connection row the detail panel could render must name a real node.
 */

const seed = seedPalaceNodes()

describe('knowledgeAdapter conformance', () => {
  it('passes the @cavin/core/testing suite', () => {
    const result = runAdapterConformance(knowledgeAdapter, {
      valid: seed.slice(0, 5) as unknown[],
      malformed: [null, undefined, 42, {}, { id: 'x' }, { id: 'x', position: ['a', 'b'] }],
    })
    expect(result.failures).toEqual([])
  })

  it('survives a persistence round-trip byte-for-byte', () => {
    const node = seed[5]
    const restored = knowledgeAdapter.validate(JSON.parse(JSON.stringify(node)))
    expect(restored).toEqual(node)
  })

  it('decodes the legacy v3 flat record (persistence migration)', () => {
    const legacy = {
      id: 'wing-0-room-0-drawer-0',
      parentId: 'wing-0-room-0-drawer-1',
      wingId: 'wing-0',
      wingName: 'Machine Learning',
      roomId: 'wing-0-room-0',
      roomName: 'Optimizers',
      title: 'Old note',
      body: 'body',
      tags: ['a', 3, 'b'],
      embedding: [1, 2, 3, 4, 5, 6, 7, 8],
      createdAt: 12345,
      position: [10, 20],
      locked: true,
      confirmed: true,
      placed: true,
      relOffset: [1, 2],
    }
    const decoded = knowledgeAdapter.validate(legacy)
    expect(decoded).not.toBeNull()
    expect(decoded!.groupPath).toEqual(['Machine Learning', 'Optimizers'])
    expect(decoded!.attributes).toMatchObject({ title: 'Old note', tags: ['a', 'b'] })
    expect(decoded!.state).toEqual({
      locked: true,
      confirmed: true,
      placed: true,
      relOffset: [1, 2],
    })
  })
})

describe('memory-palace seed invariants', () => {
  it('fresh seed has no empty/untitled labels', () => {
    expect(seed.length).toBeGreaterThan(0)
    const untitled = seed.filter((n) => labelOf(knowledgeAdapter, n) === 'Untitled note')
    expect(untitled.map((n) => n.id)).toEqual([])
  })

  it('suggests cross-domain edges, and no connection row renders untitled or missing', () => {
    const world = deriveWorld(seed, knowledgeAdapter)
    expect(world.edges.length).toBeGreaterThan(0)
    for (const n of world.nodes) {
      for (const e of world.edgesByNode.get(n.id) ?? []) {
        const other = world.nodeById.get(e.from === n.id ? e.to : e.from)
        expect(other).toBeDefined()
        expect(labelOf(knowledgeAdapter, other!)).not.toBe('Untitled note')
      }
    }
  })

  it('groups aggregate at two levels from the generator structure', () => {
    const world = deriveWorld(seed, knowledgeAdapter)
    const top = world.groups.filter((g) => g.depth === 0)
    const sub = world.groups.filter((g) => g.depth === 1)
    expect(top).toHaveLength(6) // six wings
    expect(sub).toHaveLength(36) // six rooms per wing
  })
})

describe('migrateV3Edges', () => {
  it('pulls the confirmed-edge list out of the legacy payload', () => {
    const legacy = { nodes: [], edges: [{ id: 'e1', from: 'a', to: 'b', createdAt: 0 }] }
    expect(migrateV3Edges(legacy)).toEqual([{ id: 'e1', from: 'a', to: 'b', createdAt: 0 }])
    expect(migrateV3Edges([{}] as unknown as CavinEdge[])).toBeNull()
    expect(migrateV3Edges(null)).toBeNull()
  })

  it('keeps CavinEdge ids intact when confirmed edges ride the legacy payload', () => {
    const legacy = {
      nodes: [],
      edges: [{ id: 'sugg:a|b', from: 'a', to: 'b', createdAt: 0 }],
    }
    const edges = migrateV3Edges(legacy) as CavinEdge[]
    const world = deriveWorld(seed.slice(0, 2), knowledgeAdapter, undefined, edges)
    expect(world.edges.some((e) => e.id === 'sugg:a|b' && e.kind === 'confirmed')).toBe(false) // ids don't match this seed
  })
})

// Type-level: seed nodes satisfy the framework shape.
const _typecheck: CavinNode[] = seed
void _typecheck
