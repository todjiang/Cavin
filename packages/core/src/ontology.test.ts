import { describe, expect, it } from 'vitest'
import type { SchemaAdapter } from './adapter'
import { deriveWorld } from './layout'
import { validateRelation, worldToJsonLd } from './ontology'
import type { OntologySchema } from './ontology'
import type { CavinNode } from './types'

interface Attrs {
  name: string
  kind?: string
}

const ontology: OntologySchema = {
  context: { ex: 'https://example.test/ontology#' },
  nodeBaseIri: 'https://example.test/instances/',
  classes: [
    { id: 'Person', iri: 'ex:Person', label: 'Person' },
    { id: 'Ruler', iri: 'ex:Ruler', label: 'Ruler', parent: 'Person' },
    { id: 'Place', iri: 'ex:Place', label: 'Place' },
  ],
  relations: [
    { id: 'hasRetainer', iri: 'ex:hasRetainer', label: 'has retainer', domain: 'Ruler', range: 'Person' },
    { id: 'mentorOf', iri: 'ex:mentorOf', label: 'mentor of', domain: 'Person', range: 'Person' },
    { id: 'locatedIn', iri: 'ex:locatedIn', label: 'located in', domain: 'Person', range: 'Place' },
  ],
}

function node(id: string, kind?: string): CavinNode<Attrs> {
  return {
    id,
    position: [0, 0],
    groupPath: [],
    attributes: { name: id, kind },
    state: {},
  }
}

const adapter: SchemaAdapter<Attrs> = {
  noun: 'item',
  labelOf: (n) => n.attributes.name,
  fields: [{ key: 'name', label: 'Name', kind: 'text' }],
  validate: (raw) => raw as CavinNode<Attrs>,
  createDefault: () => ({ name: 'new' }),
  ontology,
  typeOf: (n) => n.attributes.kind,
}

const nodes = [node('ruler', 'Ruler'), node('person', 'Person'), node('place', 'Place')]
const byId = new Map(nodes.map((n) => [n.id, n]))

describe('validateRelation', () => {
  it('accepts directed relations and follows the class parent for is-a checks', () => {
    expect(validateRelation(byId, { from: 'ruler', to: 'person', predicate: 'hasRetainer' }, adapter)).toEqual({ ok: true })
    expect(validateRelation(byId, { from: 'ruler', to: 'person', predicate: 'mentorOf' }, adapter)).toEqual({ ok: true })
    expect(validateRelation(byId, { from: 'person', to: 'place', predicate: 'locatedIn' }, adapter)).toEqual({ ok: true })
  })

  it('checks domain and range in from → to order', () => {
    expect(validateRelation(byId, { from: 'person', to: 'ruler', predicate: 'hasRetainer' }, adapter)).toEqual({ ok: false, error: 'invalid-domain' })
    expect(validateRelation(byId, { from: 'person', to: 'ruler', predicate: 'locatedIn' }, adapter)).toEqual({ ok: false, error: 'invalid-range' })
  })

  it('rejects unknown predicates and missing or unknown node types', () => {
    expect(validateRelation(byId, { from: 'ruler', to: 'person', predicate: 'ghost' }, adapter)).toEqual({ ok: false, error: 'unknown-predicate' })
    expect(validateRelation(byId, { from: 'ruler', to: 'place' }, adapter)).toEqual({ ok: true })
    const untyped = new Map(byId).set('person', node('person'))
    expect(validateRelation(untyped, { from: 'ruler', to: 'person', predicate: 'hasRetainer' }, adapter)).toEqual({ ok: false, error: 'missing-node-type' })
    const unknown = new Map(byId).set('person', node('person', 'Ghost'))
    expect(validateRelation(unknown, { from: 'ruler', to: 'person', predicate: 'hasRetainer' }, adapter)).toEqual({ ok: false, error: 'unknown-node-type' })
  })

  it('rejects missing endpoints and self-links', () => {
    expect(validateRelation(byId, { from: 'ruler', to: 'ghost', predicate: 'hasRetainer' }, adapter)).toEqual({ ok: false, error: 'missing' })
    expect(validateRelation(byId, { from: 'ruler', to: 'ruler', predicate: 'hasRetainer' }, adapter)).toEqual({ ok: false, error: 'self' })
  })
})

describe('worldToJsonLd', () => {
  it('deriveWorld filters invalid semantic facts but keeps legacy associations', () => {
    const world = deriveWorld(
      nodes,
      adapter,
      undefined,
      [
        { id: 'invalid', from: 'person', to: 'ruler', createdAt: 1, predicate: 'hasRetainer' },
        { id: 'legacy', from: 'person', to: 'place', createdAt: 1 },
      ],
    )
    expect(world.edges.map((edge) => edge.id)).toEqual(['legacy'])
  })

  it('exports only valid confirmed semantic facts, with stable instance identities', () => {
    const world = deriveWorld(
      nodes,
      adapter,
      undefined,
      [
        { id: 'valid', from: 'ruler', to: 'person', createdAt: 1, predicate: 'hasRetainer' },
        { id: 'legacy', from: 'person', to: 'place', createdAt: 1, label: 'near' },
        { id: 'invalid', from: 'person', to: 'ruler', createdAt: 1, predicate: 'hasRetainer' },
      ],
      undefined,
      [{ id: 'suggested', from: 'person', to: 'place', createdAt: 0, predicate: 'locatedIn' }],
    )
    const before = JSON.stringify({ nodes: world.nodes, edges: world.edges })
    const first = worldToJsonLd(world, adapter)
    const second = worldToJsonLd(world, adapter)

    expect(first).toEqual(second)
    expect(JSON.stringify({ nodes: world.nodes, edges: world.edges })).toBe(before)
    const graph = first['@graph'] as Record<string, unknown>[]
    expect(graph).toHaveLength(3)
    expect(graph[0]).toMatchObject({
      '@id': 'https://example.test/instances/ruler',
      '@type': 'ex:Ruler',
      label: 'ruler',
      'ex:hasRetainer': [{ '@id': 'https://example.test/instances/person' }],
    })
    expect(graph[1]).not.toHaveProperty('ex:hasRetainer')
    expect(graph[1]).not.toHaveProperty('ex:locatedIn')
    expect(graph[2]).not.toHaveProperty('ex:locatedIn')
  })

  it('is empty for hosts without an ontology', () => {
    const plain: SchemaAdapter<Attrs> = { ...adapter, ontology: undefined, typeOf: undefined }
    const world = deriveWorld(nodes, plain)
    expect(worldToJsonLd(world, plain)).toEqual({ '@context': {}, '@graph': [] })
  })
})
