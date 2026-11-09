import { describe, expect, it } from 'vitest'
import type { CavinNode } from '@cavin/core'
import { deriveWorld } from '@cavin/core'
import { errorText, noticeText, noticeToast } from './notices'

/**
 * The notice copy tables — mutation-result kinds → user-facing copy. Pure
 * module: no store, no React, no window.
 */

interface Attrs {
  title: string
}

const adapter = {
  noun: 'note',
  labelOf: (n: CavinNode<Attrs>) => n.attributes.title,
  fields: [{ key: 'title' as const, label: 'Title', kind: 'text' as const }],
  validate: () => null,
  createDefault: (): Attrs => ({ title: '' }),
}

describe('notices', () => {
  it('interpolates the noun into notice copy', () => {
    expect(noticeText('note', { kind: 'created' })).toBe('Note created')
    expect(noticeText('note', { kind: 'child-created' })).toBe('Child note created')
    expect(noticeText('note', { kind: 'deleted', count: 3 })).toBe('Deleted 3 notes')
    expect(noticeText('note', { kind: 'deleted', count: 1 })).toBe('Note deleted')
    expect(noticeText('note', { kind: 'locked' })).toBe('Note locked & confirmed')
    expect(noticeText('note', { kind: 'edge-confirmed' })).toBe('Connection confirmed')
  })

  it('toasts for lock/cycle errors and stays silent for no-ops', () => {
    expect(errorText('note', 'locked-node')).toBe('Note is locked — unlock it first')
    expect(errorText('note', 'locked-target')).toBe('Target is locked — unlock it first')
    expect(errorText('note', 'cycle')).toBe('Can’t nest a note inside its own descendant')
    expect(errorText('note', 'missing')).toBeNull()
    expect(errorText('note', 'self')).toBeNull()
    expect(errorText('note', 'noop')).toBeNull()
  })

  it('phrases reparented notices against the new parent’s label', () => {
    const nodes: CavinNode<Attrs>[] = [
      { id: 'a', position: [0, 0], groupPath: [], attributes: { title: 'Recipes' }, state: {} },
      { id: 'b', position: [1, 1], groupPath: [], attributes: { title: 'Pasta' }, state: {} },
    ]
    const world = deriveWorld(nodes, adapter)
    expect(noticeToast(adapter, world, { kind: 'reparented', targetId: 'a' })).toBe(
      'Moved under “Recipes”',
    )
    // Unknown target falls back to the noun rather than crashing.
    expect(noticeToast(adapter, world, { kind: 'reparented', targetId: 'ghost' })).toBe(
      'Moved under “note”',
    )
    // Non-reparented notices flow through the plain table.
    expect(noticeToast(adapter, world, { kind: 'created' })).toBe('Note created')
  })
})
