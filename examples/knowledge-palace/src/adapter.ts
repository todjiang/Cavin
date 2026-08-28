import type { CavinEdge, CavinNode, SchemaAdapter } from '@cavin/core'

/**
 * The knowledge-palace demo's data plug — the reference implementation of
 * the SchemaAdapter seam from docs/architecture-generic-framework.md §4.2.
 *
 * Attributes are pure content: grouping lives in the framework-level
 * `groupPath` (the legacy wingId/wingName/roomId/roomName denormalization
 * is gone — the v3→v4 persistence migration folds those fields into the
 * path). `validate` accepts both the v4 CavinNode record and the legacy v3
 * flat record, which is what makes the storage migration a no-op for users.
 */

export interface KnowledgeAttrs {
  title: string
  body: string
  tags: string[]
  /** Synthetic 8-dim "embedding" — drives the initial scatter + suggestions. */
  embedding: number[]
  createdAt: number
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Decode the legacy v3 flat record (wing/room fields at top level). */
function fromLegacy(n: Record<string, any>): CavinNode<KnowledgeAttrs> | null {
  if (
    typeof n.id !== 'string' ||
    typeof n.title !== 'string' ||
    typeof n.wingName !== 'string' ||
    typeof n.roomName !== 'string' ||
    !Array.isArray(n.position) ||
    !isFiniteNum(n.position[0]) ||
    !isFiniteNum(n.position[1])
  ) {
    return null
  }
  return {
    id: n.id,
    parentId: typeof n.parentId === 'string' ? n.parentId : undefined,
    position: [n.position[0], n.position[1]],
    groupPath: [n.wingName, n.roomName],
    attributes: {
      title: n.title,
      body: typeof n.body === 'string' ? n.body : '',
      tags: Array.isArray(n.tags) ? n.tags.filter((t: unknown) => typeof t === 'string') : [],
      embedding:
        Array.isArray(n.embedding) && n.embedding.every(isFiniteNum)
          ? n.embedding
          : new Array(8).fill(0),
      createdAt: isFiniteNum(n.createdAt) ? n.createdAt : Date.now(),
    },
    state: {
      locked: n.locked === true || undefined,
      confirmed: n.confirmed === true || undefined,
      placed: n.placed === true || undefined,
      relOffset:
        Array.isArray(n.relOffset) && isFiniteNum(n.relOffset[0]) && isFiniteNum(n.relOffset[1])
          ? [n.relOffset[0], n.relOffset[1]]
          : undefined,
    },
  }
}

export const knowledgeAdapter: SchemaAdapter<KnowledgeAttrs> = {
  noun: 'note',

  groupOf(node) {
    return node.groupPath ?? []
  },

  labelOf(node) {
    return node.attributes.title || 'Untitled note'
  },

  searchTextOf(node) {
    const { title, body, tags } = node.attributes
    return `${title} ${body} ${tags.join(' ')}`.toLowerCase()
  },

  fields: [
    { key: 'title', label: 'Title', kind: 'text', placeholder: 'Untitled note' },
    { key: 'body', label: 'Body', kind: 'multiline', placeholder: 'Write the note…' },
    { key: 'tags', label: 'Tags', kind: 'tags', placeholder: 'tags, comma, separated' },
    { key: 'createdAt', label: 'Created', kind: 'readonly', time: true },
  ],

  validate(raw) {
    if (!raw || typeof raw !== 'object') return null
    const n = raw as Record<string, any>
    // v4 CavinNode record.
    if (
      typeof n.id === 'string' &&
      Array.isArray(n.position) &&
      isFiniteNum(n.position[0]) &&
      isFiniteNum(n.position[1]) &&
      n.attributes &&
      typeof n.attributes === 'object' &&
      Array.isArray(n.groupPath)
    ) {
      return {
        id: n.id,
        parentId: typeof n.parentId === 'string' ? n.parentId : undefined,
        position: [n.position[0], n.position[1]],
        groupPath: n.groupPath,
        attributes: {
          title: typeof n.attributes.title === 'string' ? n.attributes.title : '',
          body: typeof n.attributes.body === 'string' ? n.attributes.body : '',
          tags: Array.isArray(n.attributes.tags)
            ? n.attributes.tags.filter((t: unknown) => typeof t === 'string')
            : [],
          embedding:
            Array.isArray(n.attributes.embedding) && n.attributes.embedding.every(isFiniteNum)
              ? n.attributes.embedding
              : new Array(8).fill(0),
          createdAt: isFiniteNum(n.attributes.createdAt) ? n.attributes.createdAt : Date.now(),
        },
        state: {
          locked: n.state?.locked === true || undefined,
          confirmed: n.state?.confirmed === true || undefined,
          placed: n.state?.placed === true || undefined,
          relOffset:
            Array.isArray(n.state?.relOffset) &&
            isFiniteNum(n.state.relOffset[0]) &&
            isFiniteNum(n.state.relOffset[1])
              ? [n.state.relOffset[0], n.state.relOffset[1]]
              : undefined,
        },
      }
    }
    // Legacy v3 flat record (pre-framework persistence shape).
    return fromLegacy(n)
  },

  createDefault() {
    return {
      title: 'Untitled note',
      body: '',
      tags: [],
      embedding: new Array(8).fill(0),
      createdAt: Date.now(),
    }
  },

  layoutVectorOf(node) {
    return node.attributes.embedding
  },
}

export const PALACE_STORAGE_KEY = 'cavin:knowledge-palace:v4'
/** Pre-framework localStorage payload (flat nodes + edges + dataset). */
export const LEGACY_STORAGE_KEY = 'cavin-world-v3'

/** Confirmed edges out of the legacy v3 payload ({nodes, edges, dataset}). */
export function migrateV3Edges(raw: unknown): CavinEdge[] | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const edges = (raw as { edges?: unknown }).edges
    if (Array.isArray(edges)) return edges as CavinEdge[]
  }
  return null
}
