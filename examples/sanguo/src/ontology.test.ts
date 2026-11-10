import { describe, expect, it } from 'vitest'
import { deriveWorld, validateRelation, worldToJsonLd } from '@cavin/core'
import { sanguoAdapter } from './adapter'
import { buildSanguoWorld } from './app-data'
import { generateSanguoEdges } from './relations'
import { sanguoOntology } from './ontology'

describe('sanguo ontology', () => {
  const { nodes, confirmedEdges } = buildSanguoWorld()
  const world = deriveWorld(nodes, sanguoAdapter, undefined, confirmedEdges)

  it('maps roles to instance types without changing spatial groups', () => {
    const liuBei = world.nodeById.get('liu-bei')!
    const zhuge = world.nodeById.get('zhuge-liang')!
    expect(sanguoAdapter.typeOf?.(liuBei)).toBe('Ruler')
    expect(sanguoAdapter.typeOf?.(zhuge)).toBe('Person')
    expect(liuBei.groupPath).toEqual(['蜀', '君主'])
    expect(zhuge.groupPath).toEqual(['蜀', '谋士'])
  })

  it('annotates only the three conservative directed relation families', () => {
    const edges = generateSanguoEdges()
    expect(edges.find((e) => e.from === 'liu-bei' && e.to === 'zhuge-liang')?.predicate).toBe('hasRetainer')
    expect(edges.find((e) => e.from === 'zhuge-liang' && e.to === 'jiang-wei')?.predicate).toBe('mentorOf')
    expect(edges.find((e) => e.from === 'zhuge-liang' && e.to === 'jiang-wan')?.predicate).toBe('recommends')
    expect(edges.find((e) => e.from === 'guan-yu' && e.to === 'zhang-fei')?.predicate).toBeUndefined()
    expect(edges.find((e) => e.from === 'xiang-chong' && e.to === 'zhuge-liang')?.predicate).toBeUndefined()
    expect(edges.some((e) => e.predicate)).toBe(true)
    expect(edges.every((e) => e.predicate)).toBe(false)
  })

  it('accepts the valid ruler relation and rejects its reverse', () => {
    expect(validateRelation(world.nodeById, { from: 'liu-bei', to: 'zhuge-liang', predicate: 'hasRetainer' }, sanguoAdapter)).toEqual({ ok: true })
    expect(validateRelation(world.nodeById, { from: 'zhuge-liang', to: 'liu-bei', predicate: 'hasRetainer' }, sanguoAdapter)).toEqual({ ok: false, error: 'invalid-domain' })
  })

  it('exports exactly the valid typed confirmed triples', () => {
    const document = worldToJsonLd(world, sanguoAdapter)
    const graph = document['@graph'] as Record<string, unknown>[]
    expect(graph).toHaveLength(nodes.length)

    const relationIris = new Set(sanguoOntology.relations.map((relation) => relation.iri))
    let exportedTriples = 0
    for (const record of graph) {
      for (const [key, value] of Object.entries(record)) {
        if (relationIris.has(key)) exportedTriples += (value as unknown[]).length
      }
    }
    const expected = confirmedEdges.filter(
      (edge) => edge.predicate && validateRelation(world.nodeById, edge, sanguoAdapter).ok,
    ).length
    expect(exportedTriples).toBe(expected)

    const liuBei = graph.find((record) => record['@id'] === 'https://cavin.example/instances/sanguo/liu-bei')!
    expect(liuBei['@type']).toBe('sanguo:Ruler')
    expect(liuBei['sanguo:hasRetainer']).toEqual([
      { '@id': 'https://cavin.example/instances/sanguo/zhuge-liang' },
      { '@id': 'https://cavin.example/instances/sanguo/guan-yu' },
      { '@id': 'https://cavin.example/instances/sanguo/zhang-fei' },
      { '@id': 'https://cavin.example/instances/sanguo/zhao-yun' },
      { '@id': 'https://cavin.example/instances/sanguo/ma-chao' },
      { '@id': 'https://cavin.example/instances/sanguo/huang-zhong' },
      { '@id': 'https://cavin.example/instances/sanguo/fa-zheng' },
      { '@id': 'https://cavin.example/instances/sanguo/pang-tong' },
    ])
  })
})
