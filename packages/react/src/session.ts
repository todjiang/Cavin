import type { CavinEdge, CavinNode, CavinStorage, LayoutConfig, SchemaAdapter, World } from '@cavin/core'
import { deriveWorld } from '@cavin/core'
import type { SuggestionCache } from './suggestions'

/**
 * Session: boot / reset / persistence. One module owns the storage wins-
 * else-draft boot rule, the suggestion-list bookkeeping and the debounced
 * snapshot save — with the scheduler injected so nothing here touches
 * `window` and tests can run headless.
 */

export interface Scheduler {
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (id: unknown) => void
}

/** Production scheduler — the only place `window` timers are referenced. */
export const windowScheduler: Scheduler = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
}

export interface SessionOptions<TAttr> {
  adapter: SchemaAdapter<TAttr>
  config: LayoutConfig
  storage: CavinStorage<TAttr>
  /** Call-site owner of the machine-suggestion list. */
  suggestions: SuggestionCache<TAttr>
  /** The machine draft this canvas edits (first boot, and demo resets). */
  initialNodes?: CavinNode<TAttr>[]
  initialEdges?: CavinEdge[]
  /** Inject a fake scheduler in tests; defaults to window timers. */
  scheduler?: Scheduler
}

export interface Session<TAttr> {
  /** Restore the persisted snapshot if present, else the initial draft. */
  boot(): World<TAttr>
  /** Wipe persistence and rebuild from the initial draft. */
  reset(): World<TAttr>
  /**
   * The suggestion array the current world was derived with. Identity-equal
   * means no suggestion input changed — the world's suggestion list is still
   * correct and no re-derive is needed.
   */
  readonly appliedSuggested: CavinEdge[]
  /**
   * Re-derive with a fresh suggestion list when the inputs suggestEdges
   * reads changed; otherwise return the world as-is.
   */
  withFreshSuggestions(world: World<TAttr>): World<TAttr>
  /**
   * Debounced snapshot persistence (300 ms) over a world-changing
   * subscription. A failed save surfaces as a one-shot toast.
   */
  persistOnChange(
    watch: {
      subscribe(fn: (s: { world: World<TAttr> }, prev: { world: World<TAttr> }) => void): void
    },
    toast: (text: string) => void,
  ): void
}

const confirmedOf = <TAttr>(world: World<TAttr>): CavinEdge[] =>
  world.edges.filter((e) => e.kind === 'confirmed')

export function createSession<TAttr>(options: SessionOptions<TAttr>): Session<TAttr> {
  const { adapter, config, storage, suggestions } = options
  const scheduler = options.scheduler ?? windowScheduler
  let appliedSuggested: CavinEdge[] = []

  const deriveWith = (nodes: CavinNode<TAttr>[], confirmed: CavinEdge[]): World<TAttr> => {
    const suggested = suggestions.suggest(nodes)
    appliedSuggested = suggested
    return deriveWorld(nodes, adapter, undefined, confirmed, config, suggested)
  }

  return {
    get appliedSuggested() {
      return appliedSuggested
    },

    withFreshSuggestions(world) {
      const suggested = suggestions.suggest(world.nodes)
      if (suggested === appliedSuggested) return world
      appliedSuggested = suggested
      return deriveWorld(world.nodes, adapter, world, confirmedOf(world), config, suggested)
    },

    boot() {
      try {
        const stored = storage.load()
        if (stored) return deriveWith(stored.nodes, stored.confirmedEdges)
      } catch {
        // Corrupt shape — fall through to the initial draft.
      }
      return deriveWith(options.initialNodes ?? [], options.initialEdges ?? [])
    },

    reset() {
      storage.clear()
      return deriveWith(options.initialNodes ?? [], options.initialEdges ?? [])
    },

    persistOnChange(watch, toast) {
      let timer: unknown
      let warned = false
      watch.subscribe((s, prev) => {
        if (s.world === prev.world) return
        scheduler.clearTimeout(timer)
        timer = scheduler.setTimeout(() => {
          const ok = storage.save({
            nodes: s.world.nodes,
            confirmedEdges: confirmedOf(s.world),
          })
          if (!ok && !warned) {
            warned = true
            toast('Storage full — changes won’t persist')
          } else if (ok) {
            warned = false
          }
        }, 300)
      })
    },
  }
}
