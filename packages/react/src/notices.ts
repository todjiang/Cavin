import type { MutationError, MutationNotice, SchemaAdapter, World } from '@cavin/core'
import { labelOf } from '@cavin/core'

/**
 * The notice copy tables: mutation-result kinds → user-facing English,
 * interpolated with the adapter's noun. One module owns all of it so the
 * store stays a thin shell and the copy is unit-testable without React.
 */

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** Notice-kind → user-facing copy, interpolated with the adapter's noun. */
export function noticeText(noun: string, notice: MutationNotice): string | null {
  switch (notice.kind) {
    case 'created':
      return `${cap(noun)} created`
    case 'child-created':
      return `Child ${noun} created`
    case 'saved':
      return 'Saved'
    case 'rejoined':
    case 'reset-orbit':
      return 'Back in orbit'
    case 'reset-root':
      return 'Back in the grid'
    case 'promoted':
      return `Promoted to a root ${noun}`
    case 'locked':
      return `${cap(noun)} locked & confirmed`
    case 'unlocked':
      return `${cap(noun)} unlocked`
    case 'deleted':
      return notice.count && notice.count > 1
        ? `Deleted ${notice.count} ${noun}s`
        : `${cap(noun)} deleted`
    case 'edge-confirmed':
      return 'Connection confirmed'
    case 'edge-removed':
      return 'Connection removed'
    case 'reparented':
      return null // resolved by noticeToast against the new parent's label
  }
}

/** Error-kind → user-facing copy; silent for no-ops (missing/self/noop). */
export function errorText(noun: string, error: MutationError): string | null {
  switch (error) {
    case 'locked-node':
      return `${cap(noun)} is locked — unlock it first`
    case 'locked-target':
      return 'Target is locked — unlock it first'
    case 'cycle':
      return `Can’t nest a ${noun} inside its own descendant`
    default:
      return null
  }
}

/**
 * The full toast line for a mutation notice. The `reparented` kind needs the
 * NEW parent's label (a tree lookup + labelOf), which pure copy tables can't
 * carry — so this helper takes the world and phrases it here, keeping the
 * store free of copy concerns.
 */
export function noticeToast<TAttr>(
  adapter: SchemaAdapter<TAttr>,
  world: World<TAttr>,
  notice: MutationNotice,
): string | null {
  if (notice.kind === 'reparented') {
    const parent = world.nodeById.get(notice.targetId ?? '')
    return `Moved under “${parent ? labelOf(adapter, parent) : adapter.noun}”`
  }
  return noticeText(adapter.noun, notice)
}
