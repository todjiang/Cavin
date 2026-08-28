import type { CavinNode, SchemaAdapter } from '@cavin/core'

/**
 * The P4 genericity harness: a flat task list with NO grouping levels —
 * empty groupPath, no time axis, no persistence — mounting the exact same
 * <CavinCanvas/> the palace uses, against a ~20-line adapter.
 */

export interface TaskAttrs {
  title: string
  done: boolean
  effort: number
}

export const taskAdapter: SchemaAdapter<TaskAttrs> = {
  noun: 'task',

  groupOf: () => [],
  labelOf: (n) => (n.attributes.done ? '☑ ' : '☐ ') + n.attributes.title,

  fields: [
    { key: 'title', label: 'Task', kind: 'text', placeholder: 'What needs doing?' },
    { key: 'effort', label: 'Effort', kind: 'readonly' },
  ],

  validate(raw) {
    const n = raw as Record<string, any>
    if (
      !n ||
      typeof n.id !== 'string' ||
      !Array.isArray(n.position) ||
      typeof n.attributes?.title !== 'string'
    ) {
      return null
    }
    return {
      id: n.id,
      parentId: typeof n.parentId === 'string' ? n.parentId : undefined,
      position: [Number(n.position[0]), Number(n.position[1])],
      groupPath: Array.isArray(n.groupPath) ? n.groupPath : [],
      attributes: { title: n.attributes.title, done: n.attributes.done === true, effort: Number(n.attributes.effort) || 0 },
      state: {
        locked: n.state?.locked === true || undefined,
        placed: n.state?.placed === true || undefined,
        relOffset: n.state?.relOffset,
      },
    }
  },

  createDefault: () => ({ title: 'New task', done: false, effort: 1 }),
}

const TITLES = [
  'Write the changelog',
  'Shrink the bundle',
  'Fix the flaky test',
  'Review the PRs',
  'Refill the coffee machine',
  'Pair on the importer',
  'Sketch the next quarter',
  'Prune the backlog',
  'Ship the release',
  'Water the plants',
]

export function seedTasks(): CavinNode<TaskAttrs>[] {
  return TITLES.map((title, i) => ({
    id: `task-${i}`,
    position: [0, 0],
    groupPath: [],
    attributes: { title, done: i % 4 === 0, effort: 1 + (i % 3) },
    state: {},
  }))
}
