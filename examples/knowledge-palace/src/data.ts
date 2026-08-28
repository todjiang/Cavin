import { layoutNodes } from '@cavin/core'
import type { CavinNode } from '@cavin/core'
import { generateNodes } from '../../machine-learning/generate'
import type { KnowledgeNode } from '../../machine-learning/generate'
import { knowledgeAdapter } from './adapter'
import type { KnowledgeAttrs } from './adapter'

/**
 * The machine-palace seed: the procedural generator's flat records converted
 * to CavinNodes, then scattered by the core's initial layout (similarity-
 * scaled via the adapter's embedding vectors).
 */
export function toCavinNodes(flat: KnowledgeNode[]): CavinNode<KnowledgeAttrs>[] {
  return flat.map((n) => ({
    id: n.id,
    parentId: n.parentId,
    // Placeholder — the core layout pass below assigns real positions.
    position: [0, 0],
    groupPath: [n.wingName, n.roomName],
    attributes: {
      title: n.title,
      body: n.body,
      tags: n.tags,
      embedding: n.embedding,
      createdAt: n.createdAt,
    },
    state: {},
  }))
}

/** Build the fresh-seed node array (deterministic mulberry32, "today"-anchored). */
export function seedPalaceNodes(): CavinNode<KnowledgeAttrs>[] {
  return layoutNodes(toCavinNodes(generateNodes()), knowledgeAdapter)
}
