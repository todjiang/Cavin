import type { SchemaAdapter } from '../core/schema'
import type { KnowledgeNode } from './generate'

/** Attributes-only view of the demo schema: identity (id/parentId) is
    framework-owned, so the adapter contract never sees it. */
type KnowledgeAttrs = Omit<KnowledgeNode, 'id' | 'parentId'>

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * The knowledge-palace demo's data plug — the reference implementation of the
 * SchemaAdapter seam from docs/architecture-generic-framework.md §4.2.
 *
 * Transitional note (P2): the app still materializes wing/room fields onto
 * LaidOutNode for the UI, so `createDefault` derives provisional wing/room
 * ids from the group path — the world store overrides them with the
 * authoritative ids of the target room/parent right after calling this.
 * `validate` decodes the legacy flat persisted shape (id/parentId/position at
 * top level) into a CavinNode; persistence itself still uses the flat shape.
 */
export const knowledgeAdapter: SchemaAdapter<KnowledgeAttrs> = {
  noun: 'note',

  groupOf(node) {
    return [node.attributes.wingName, node.attributes.roomName]
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
    { key: 'createdAt', label: 'Created', kind: 'readonly' },
  ],

  validate(raw) {
    if (!raw || typeof raw !== 'object') return null
    const n = raw as Record<string, any>
    if (
      typeof n.id !== 'string' ||
      typeof n.title !== 'string' ||
      typeof n.wingId !== 'string' ||
      typeof n.wingName !== 'string' ||
      typeof n.roomId !== 'string' ||
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
        wingId: n.wingId,
        wingName: n.wingName,
        roomId: n.roomId,
        roomName: n.roomName,
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
  },

  createDefault(ctx) {
    return {
      // Provisional ids derived from the display names — the caller (world
      // store) overrides wingId/roomId with the target cluster's real ids.
      wingId: ctx.groupPath[0]?.replace(/\s+/g, '-').toLowerCase() ?? 'unknown',
      wingName: ctx.groupPath[0] ?? 'Unknown',
      roomId: ctx.groupPath[1]?.replace(/\s+/g, '-').toLowerCase() ?? 'unknown',
      roomName: ctx.groupPath[1] ?? 'Unknown',
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
