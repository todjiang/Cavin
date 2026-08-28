import type { CavinNode, SchemaAdapter } from '@cavin/core'
import type { Camp, Role, SanguoAttrs, SanguoNode } from './types'
import { CAMPS, ROLES } from './types'

/**
 * The sanguo data plug. Grouping is camp → role; the time axis is a
 * person's peak year (184–280), so the framework's time-dimension slider
 * scrubs Chinese history instead of wall-clock dates.
 */

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isCamp(v: unknown): v is Camp {
  return typeof v === 'string' && (CAMPS as string[]).includes(v)
}
function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as string[]).includes(v)
}

export const sanguoAdapter: SchemaAdapter<SanguoAttrs> = {
  noun: 'person',

  groupOf(node) {
    return node.groupPath ?? [node.attributes.camp, node.attributes.role]
  },

  labelOf(node) {
    const { name, courtesy } = node.attributes
    return courtesy ? `${name}（${courtesy}）` : name
  },

  searchTextOf(node) {
    const { name, courtesy, bio, tags } = node.attributes
    return `${name} ${courtesy ?? ''} ${bio} ${tags.join(' ')}`.toLowerCase()
  },

  fields: [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'bio', label: 'Bio', kind: 'multiline' },
    { key: 'tags', label: 'Tags', kind: 'tags' },
    { key: 'peakYear', label: 'Peak year', kind: 'readonly', time: true },
  ],

  validate(raw) {
    if (!raw || typeof raw !== 'object') return null
    const n = raw as Record<string, any>
    if (
      typeof n.id !== 'string' ||
      !Array.isArray(n.position) ||
      !isFiniteNum(n.position[0]) ||
      !isFiniteNum(n.position[1]) ||
      !Array.isArray(n.groupPath) ||
      !n.groupPath.every((s: unknown) => typeof s === 'string') ||
      !n.attributes ||
      typeof n.attributes.name !== 'string' ||
      !isCamp(n.attributes.camp) ||
      !isRole(n.attributes.role)
    ) {
      return null
    }
    const a = n.attributes
    return {
      id: n.id,
      parentId: typeof n.parentId === 'string' ? n.parentId : undefined,
      position: [n.position[0], n.position[1]],
      groupPath: [...n.groupPath],
      attributes: {
        ...a,
        name: a.name,
        camp: a.camp,
        role: a.role,
        bio: typeof a.bio === 'string' ? a.bio : '',
        tags: Array.isArray(a.tags) ? a.tags.filter((t: unknown) => typeof t === 'string') : [],
        stats: Array.isArray(a.stats) && a.stats.every(isFiniteNum) ? a.stats : [],
        timeSpan: a.timeSpan && typeof a.timeSpan === 'object' ? a.timeSpan : {},
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
  },

  createDefault({ groupPath }) {
    return {
      name: '未命名',
      camp: isCamp(groupPath[0]) ? groupPath[0] : '群雄',
      role: isRole(groupPath[1]) ? groupPath[1] : '武将',
      summary: '',
      bio: '',
      tags: [],
      // Zero vector, 8-dim like the derived stats vectors: a fresh person
      // has no meaningful stats, so the suggestion engine must not attach
      // machine-suggested connections to it (users confirm relations
      // deliberately instead).
      stats: new Array(8).fill(0),
      timeSpan: {},
    }
  },

  layoutVectorOf(node) {
    return node.attributes.stats
  },
}

/** The sanguo nodes already arrive in the framework shape — assert it. */
export function asCavinNodes(nodes: SanguoNode[]): CavinNode<SanguoAttrs>[] {
  return nodes
}
