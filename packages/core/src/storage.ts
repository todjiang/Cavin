import type { CavinEdge } from './edges'
import type { CavinNode } from './types'
import type { SchemaAdapter } from './adapter'

/**
 * The persisted snapshot: the WHOLE editable state — nodes plus the
 * human-confirmed edge list — behind one interface. Callers talk to
 * `CavinStorage` only; records are decoded through `adapter.validate` at the
 * boundary, so the on-disk shape is the host's business. All implementations
 * must be fail-safe (quota, privacy mode, corrupt payloads → behave as
 * absent). `null` means ABSENT (never saved / unreadable); an emptied world
 * round-trips as `{ nodes: [], confirmedEdges: [] }`, never as absent.
 *
 * The localStorage implementation lives in @cavin/react (it touches the
 * DOM); @cavin/core ships the interface and this memory implementation
 * (tests, headless hosts, examples without persistence).
 */
export interface WorldSnapshot<TAttr = unknown> {
  nodes: CavinNode<TAttr>[]
  confirmedEdges: CavinEdge[]
}

export interface CavinStorage<TAttr = unknown> {
  /** Restore the persisted snapshot; null only when absent/corrupt. */
  load(): WorldSnapshot<TAttr> | null
  /** Returns true on success; false when the save was rejected (quota/privacy). */
  save(snapshot: WorldSnapshot<TAttr>): boolean
  clear(): void
  /**
   * External-change notification (another tab today, a server push tomorrow).
   * Receives the new snapshot, or null when the storage was cleared
   * externally. Returns an unsubscribe function. Optional — stores that
   * can't push changes simply omit it.
   */
  subscribe?(onChange: (snapshot: WorldSnapshot<TAttr> | null) => void): () => void
}

/** In-memory storage: the default for tests and examples without persistence. */
export function createMemoryCavinStorage<TAttr>(): CavinStorage<TAttr> {
  let snapshot: WorldSnapshot<TAttr> | null = null
  const listeners = new Set<(snapshot: WorldSnapshot<TAttr> | null) => void>()
  return {
    load: () => snapshot,
    save(next) {
      snapshot = next
      return true
    },
    clear() {
      snapshot = null
      for (const l of listeners) l(null)
    },
    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
  }
}

/** Validate an array of raw node records through the adapter, dropping
    malformed entries (never throws). Returns null when `records` is not an
    array at all (absent/corrupt); `dropped` reports how many records were
    discarded so storage implementations can surface it (the core never
    prints). */
export function validateRecords<TAttr>(
  records: unknown,
  adapter: SchemaAdapter<TAttr>,
): { nodes: CavinNode<TAttr>[]; dropped: number } | null {
  if (!Array.isArray(records)) return null
  const nodes: CavinNode<TAttr>[] = []
  let dropped = 0
  for (const record of records) {
    try {
      const n = adapter.validate(record)
      if (n) nodes.push(n)
      else dropped++
    } catch {
      dropped++
    }
  }
  return { nodes, dropped }
}
