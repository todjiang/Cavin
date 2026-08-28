import type { CavinNode } from './types'
import type { SchemaAdapter } from './adapter'

/** Shared fixtures for the core contract tests. */

export interface TestAttrs {
  title: string
  embedding: number[]
}

export const testAdapter: SchemaAdapter<TestAttrs> = {
  noun: 'item',
  groupOf: (n) => n.groupPath ?? [],
  labelOf: (n) => n.attributes.title,
  fields: [{ key: 'title', label: 'Title', kind: 'text' }],
  validate: () => null,
  createDefault: () => ({ title: '', embedding: new Array(8).fill(0) }),
  layoutVectorOf: (n) => n.attributes.embedding,
}

export function makeNode(
  partial: Partial<CavinNode<TestAttrs>> & { id: string },
): CavinNode<TestAttrs> {
  return {
    position: [0, 0],
    groupPath: ['ML', 'Optimizers'],
    attributes: { title: partial.id, embedding: [1, 0, 0, 0, 0, 0, 0, 0] },
    state: {},
    ...partial,
  }
}

/** a(root) → b → c, d(root in another group) */
export function family(): CavinNode<TestAttrs>[] {
  return [
    makeNode({ id: 'a', position: [100, 100] }),
    makeNode({ id: 'b', parentId: 'a', state: { relOffset: [10, 0] }, position: [110, 100] }),
    makeNode({ id: 'c', parentId: 'b', state: { relOffset: [0, 10] }, position: [110, 110] }),
    makeNode({ id: 'd', groupPath: ['Design', 'Typography'], position: [900, 900] }),
  ]
}
