import { describe, expect, it } from 'vitest'
import { defaultKeymap, resolveHotkey, type HotkeyEvent } from './keymap'

/**
 * The one hotkey policy. Plain-object events — no DOM needed.
 */

const ev = (over: Partial<HotkeyEvent>): HotkeyEvent => ({
  key: '',
  target: null,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  isComposing: false,
  ...over,
})

const input = { tagName: 'INPUT' } as unknown as EventTarget
const textarea = { tagName: 'TEXTAREA' } as unknown as EventTarget
const canvas = { tagName: 'CANVAS' } as unknown as EventTarget

describe('resolveHotkey', () => {
  it('maps the plain bindings on non-typing targets', () => {
    expect(resolveHotkey(defaultKeymap, ev({ key: 'Escape', target: canvas }))).toBe('select-none')
    expect(resolveHotkey(defaultKeymap, ev({ key: 'Delete', target: canvas }))).toBe('delete')
    expect(resolveHotkey(defaultKeymap, ev({ key: 'Backspace', target: canvas }))).toBe('delete')
    expect(resolveHotkey(defaultKeymap, ev({ key: 'l', target: canvas }))).toBe('toggle-lock')
    expect(resolveHotkey(defaultKeymap, ev({ key: 'C', target: canvas }))).toBe('add-child')
    expect(resolveHotkey(defaultKeymap, ev({ key: 'n', target: canvas }))).toBe('add-node')
    expect(resolveHotkey(defaultKeymap, ev({ key: '/', target: canvas }))).toBe('focus-search')
  })

  it('never fires plain actions while typing — including in a textarea', () => {
    expect(resolveHotkey(defaultKeymap, ev({ key: 'l', target: input }))).toBeNull()
    expect(resolveHotkey(defaultKeymap, ev({ key: 'n', target: textarea }))).toBeNull()
    expect(resolveHotkey(defaultKeymap, ev({ key: 'Delete', target: textarea }))).toBeNull()
    expect(resolveHotkey(defaultKeymap, ev({ key: 'Escape', target: input }))).toBeNull()
    expect(resolveHotkey(defaultKeymap, ev({ key: '/', target: textarea }))).toBeNull()
  })

  it('fires Cmd/Ctrl+K even inside an input, but respects IME composition', () => {
    expect(resolveHotkey(defaultKeymap, ev({ key: 'k', metaKey: true, target: input }))).toBe(
      'focus-search',
    )
    expect(resolveHotkey(defaultKeymap, ev({ key: 'k', ctrlKey: true, target: textarea }))).toBe(
      'focus-search',
    )
    expect(
      resolveHotkey(defaultKeymap, ev({ key: 'k', metaKey: true, target: input, isComposing: true })),
    ).toBeNull()
  })

  it('ignores modified keys outside the search binding', () => {
    expect(resolveHotkey(defaultKeymap, ev({ key: 'l', metaKey: true, target: canvas }))).toBeNull()
    expect(resolveHotkey(defaultKeymap, ev({ key: 'n', altKey: true, target: canvas }))).toBeNull()
  })

  it('honors host keymap overrides', () => {
    const custom = { ...defaultKeymap, toggleLock: 'x', addNode: 'm' }
    expect(resolveHotkey(custom, ev({ key: 'x', target: canvas }))).toBe('toggle-lock')
    expect(resolveHotkey(custom, ev({ key: 'm', target: canvas }))).toBe('add-node')
    expect(resolveHotkey(custom, ev({ key: 'l', target: canvas }))).toBeNull()
  })
})
