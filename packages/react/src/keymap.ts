/**
 * The one hotkey policy. Board and SearchBox used to each implement their
 * own keydown listener with different guards — `/` fired while typing in a
 * textarea in one and not the other. Now both consume resolveHotkey, and a
 * host can override the bindings through CavinCanvas's `keymap` prop.
 *
 * Pure module: takes a KeyboardEvent-shaped input, returns a semantic
 * action — unit-testable with plain objects, no DOM.
 */

export type HotkeyAction =
  | 'focus-search'
  | 'select-none'
  | 'delete'
  | 'toggle-lock'
  | 'add-child'
  | 'add-node'

/** Binding surface: the key (lowercased) for each plain/modified action. */
export interface Keymap {
  /** Cmd/Ctrl + this key focuses search (works inside inputs). */
  search: string
  toggleLock: string
  addChild: string
  addNode: string
}

export const defaultKeymap: Keymap = {
  search: 'k',
  toggleLock: 'l',
  addChild: 'c',
  addNode: 'n',
}

export interface HotkeyEvent {
  key: string
  target: EventTarget | null
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  /** Mid-IME composition — never fire hotkeys. */
  isComposing: boolean
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  // Structural check (no instanceof) so the policy is testable with plain
  // objects — anything Element-shaped with a tagName qualifies.
  const el = target as { tagName?: string; isContentEditable?: boolean } | null
  if (!el?.tagName) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true
}

/**
 * Map a keydown to a semantic action, or null when the event should be left
 * alone. Policy, in one place:
 * - never during IME composition;
 * - Cmd/Ctrl+search focuses search, even inside an input (platform standard);
 * - every other action requires a non-typing target and no modifiers.
 */
export function resolveHotkey(keymap: Keymap, e: HotkeyEvent): HotkeyAction | null {
  if (e.isComposing) return null
  const k = e.key.toLowerCase()
  if ((e.metaKey || e.ctrlKey) && !e.altKey && k === keymap.search) return 'focus-search'
  if (isTypingTarget(e.target)) return null
  if (e.key === '/') return 'focus-search'
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (e.key === 'Escape') return 'select-none'
  if (e.key === 'Delete' || e.key === 'Backspace') return 'delete'
  if (k === keymap.toggleLock) return 'toggle-lock'
  if (k === keymap.addChild) return 'add-child'
  if (k === keymap.addNode) return 'add-node'
  return null
}
