import type { SchemaAdapter } from './adapter'
import type { CavinNode, World } from './types'

/**
 * Optional semantic layer over Cavin's spatial/tree model. Class ids are
 * stable host-local keys; IRIs are used only at the JSON-LD boundary.
 * `parent` is deliberately just an is-a link for domain/range checks, not a
 * general inheritance or reasoning engine.
 */
export interface OntologyClass {
  id: string
  iri: string
  label: string
  parent?: string
}

export interface OntologyRelation {
  id: string
  iri: string
  label: string
  domain: string
  range: string
}

export interface OntologySchema {
  /** JSON-LD prefixes/terms used by class and relation IRIs. */
  context: Record<string, string>
  /** Absolute IRI prefix for instance ids; the encoded node id is appended. */
  nodeBaseIri: string
  classes: OntologyClass[]
  relations: OntologyRelation[]
}

export type RelationValidationError =
  | 'missing'
  | 'self'
  | 'unknown-predicate'
  | 'missing-node-type'
  | 'unknown-node-type'
  | 'invalid-domain'
  | 'invalid-range'

export type RelationValidationResult =
  | { ok: true }
  | { ok: false; error: RelationValidationError }

export function ontologyRelation(
  schema: OntologySchema,
  predicate: string,
): OntologyRelation | undefined {
  return schema.relations.find((relation) => relation.id === predicate)
}

function isA(schema: OntologySchema, actual: string, expected: string): boolean {
  const seen = new Set<string>()
  let current: string | undefined = actual
  while (current && !seen.has(current)) {
    if (current === expected) return true
    seen.add(current)
    current = schema.classes.find((item) => item.id === current)?.parent
  }
  return false
}

/** Validate one edge against the adapter's optional semantic schema. Edges
    without a predicate remain ordinary, undirected Cavin associations. */
export function validateRelation<TAttr>(
  nodeById: ReadonlyMap<string, CavinNode<TAttr>>,
  edge: { from: string; to: string; predicate?: string },
  adapter: SchemaAdapter<TAttr>,
): RelationValidationResult {
  const from = nodeById.get(edge.from)
  const to = nodeById.get(edge.to)
  if (!from || !to) return { ok: false, error: 'missing' }
  if (edge.from === edge.to) return { ok: false, error: 'self' }
  if (!edge.predicate) return { ok: true }

  const schema = adapter.ontology
  const relation = schema && ontologyRelation(schema, edge.predicate)
  if (!schema || !relation) return { ok: false, error: 'unknown-predicate' }

  const fromType = adapter.typeOf?.(from)
  const toType = adapter.typeOf?.(to)
  if (!fromType || !toType) return { ok: false, error: 'missing-node-type' }
  if (
    !schema.classes.some((item) => item.id === fromType) ||
    !schema.classes.some((item) => item.id === toType)
  ) {
    return { ok: false, error: 'unknown-node-type' }
  }
  if (!isA(schema, fromType, relation.domain)) return { ok: false, error: 'invalid-domain' }
  if (!isA(schema, toType, relation.range)) return { ok: false, error: 'invalid-range' }
  return { ok: true }
}

function nodeIri(schema: OntologySchema, id: string): string {
  return `${schema.nodeBaseIri}${encodeURIComponent(id)}`
}

/**
 * Export the instance graph, not the visual world: no positions, groups,
 * locks, arbitrary attributes, suggestions, or untyped associations. RDF
 * predicates are directional, so only confirmed semantic edges become facts.
 */
export function worldToJsonLd<TAttr>(
  world: World<TAttr>,
  adapter: SchemaAdapter<TAttr>,
): Record<string, unknown> {
  const schema = adapter.ontology
  if (!schema) return { '@context': {}, '@graph': [] }

  const graph: Record<string, unknown>[] = []
  const byNodeId = new Map<string, Record<string, unknown>>()
  for (const node of world.nodes) {
    const record: Record<string, unknown> = {
      '@id': nodeIri(schema, node.id),
      label: adapter.labelOf(node),
    }
    const type = adapter.typeOf?.(node)
    const classIri = type
      ? schema.classes.find((item) => item.id === type)?.iri
      : undefined
    if (classIri) record['@type'] = classIri
    graph.push(record)
    byNodeId.set(node.id, record)
  }

  for (const edge of world.edges) {
    if (edge.kind !== 'confirmed' || !edge.predicate) continue
    if (!validateRelation(world.nodeById, edge, adapter).ok) continue
    const relation = ontologyRelation(schema, edge.predicate)
    const subject = byNodeId.get(edge.from)
    if (!relation || !subject) continue
    const object = { '@id': nodeIri(schema, edge.to) }
    const values = subject[relation.iri]
    if (Array.isArray(values)) values.push(object)
    else subject[relation.iri] = [object]
  }

  return {
    '@context': {
      ...schema.context,
      label: 'http://www.w3.org/2000/01/rdf-schema#label',
    },
    '@graph': graph,
  }
}
