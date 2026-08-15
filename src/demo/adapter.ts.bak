import type { CavinNode, SchemaAdapter } from '../core/schema'
import type { KnowledgeNode } from './generate'

export const knowledgeAdapter: SchemaAdapter<KnowledgeNode> = {
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

  colorOf(groupPath) {
    const hue = (groupPath[0]?.length ?? 0) * 60 + 15
    return `hsl(${hue}, 70%, 62%)`
  },

  fields: [
    { key: 'title', label: 'Title', kind: 'text', placeholder: 'Untitled note' },
    { key: 'body', label: 'Body', kind: 'multiline', placeholder: 'Write the note…' },
    { key: 'tags', label: 'Tags', kind: 'tags', placeholder: 'tags, comma, separated' },
    { key: 'createdAt', label: 'Created', kind: 'readonly' },
  ],

  validate(raw) {
    if (!raw || typeof raw !== 'object') return null
    const n = raw as Partial<CavinNode<KnowledgeNode>> & KnowledgeNode
    if (
      typeof n.id !== 'string' ||
      typeof n.wingId !== 'string' ||
      typeof n.wingName !== 'string' ||
      typeof n.roomId !== 'string' ||
      typeof n.roomName !== 'string' ||
      typeof n.title !== 'string' ||
      typeof n.body !== 'string' ||
      !Array.isArray(n.tags) ||
      !Array.isArray(n.embedding) ||
      n.embedding.length !== 8 ||
      typeof n.createdAt !== 'number' ||
      !Array.isArray(n.position) ||
      typeof n.position[0] !== 'number' ||
      typeof n.position[1] !== 'number'
    ) {
      return null
    }
    return {
      id: n.id,
      parentId: n.parentId,
      position: n.position as [number, number],
      groupPath: [n.wingName, n.roomName],
      attributes: {
        wingId: n.wingId,
        wingName: n.wingName,
        roomId: n.roomId,
        roomName: n.roomName,
        title: n.title,
        body: n.body,
        tags: n.tags,
        embedding: n.embedding,
        createdAt: n.createdAt,
      },
      state: {
        locked: n.locked,
        confirmed: n.confirmed,
        placed: n.placed,
        relOffset: n.relOffset,
      },
    }
  },

  createDefault(ctx) {
    return {
      wingId: ctx.groupPath[0]?.replace(/\s+/g, '-').toLowerCase() ?? 'unknown',
      wingName: ctx.groupPath[0] ?? 'Unknown',
      roomId: ctx.groupPath[1]?.replace(/\s+/g, '-').toLowerCase() ?? 'unknown',
      roomName: ctx.groupPath[1] ?? 'Unknown',
      title: '',
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
