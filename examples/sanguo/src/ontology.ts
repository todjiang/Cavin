import type { OntologySchema } from '@cavin/core'
import { PERSONAE } from './personae'

/** A deliberately small semantic vocabulary for the Sanguo example. Camps and
    roles still drive spatial groups; only the ruler role adds an is-a type. */
export const sanguoOntology: OntologySchema = {
  context: { sanguo: 'https://cavin.example/ontology/sanguo#' },
  nodeBaseIri: 'https://cavin.example/instances/sanguo/',
  classes: [
    { id: 'Person', iri: 'sanguo:Person', label: '人物' },
    { id: 'Ruler', iri: 'sanguo:Ruler', label: '君主', parent: 'Person' },
  ],
  relations: [
    { id: 'hasRetainer', iri: 'sanguo:hasRetainer', label: '君臣', domain: 'Ruler', range: 'Person' },
    { id: 'mentorOf', iri: 'sanguo:mentorOf', label: '师徒', domain: 'Person', range: 'Person' },
    { id: 'recommends', iri: 'sanguo:recommends', label: '举荐', domain: 'Person', range: 'Person' },
  ],
}

const rulerIds = new Set(PERSONAE.filter((person) => person.role === '君主').map((person) => person.id))

/** Conservative annotation of existing prose labels. Ambiguous/reversed
    descriptions stay legacy associations instead of being rewritten. */
export function sanguoPredicate(relation: { from: string; type: string }): string | undefined {
  if (relation.type.includes('师徒')) return 'mentorOf'
  // “出师表举荐” is stored from the recommended person to the recommender;
  // composite prose stays untyped rather than becoming a reversed fact.
  if (relation.type === '举荐' || relation.type === '举荐 · 继任') return 'recommends'
  if (relation.type.includes('君臣') && rulerIds.has(relation.from)) return 'hasRetainer'
  return undefined
}
