import type { CavinNode } from './types'
import type { SchemaAdapter } from './adapter'

/**
 * Persistence behind an interface. Callers talk to `CavinStorage` only —
 * records are decoded through `adapter.validate` at the boundary, so the
 * persisted shape is the host's business. All implementations must be
 * fail-safe (quota, privacy mode, corrupt payloads → behave as empty).
 *
 * The localStorage implementation lives in @cavin/react (it touches the
 * DOM); @cavin/core ships the interface and this memory implementation
 * (tests, headless hosts, examples without persistence).
 */
export interface CavinStorage<TAttr = unknown> {
  /** Restore the persisted nodes, or null when absent/corrupt. */
  load(): CavinNode<TAttr>[] | null
  /** Returns true on success; false when the save was rejected (quota/privacy). */
  save(nodes: CavinNode<TAttr>[]): boolean
  clear(): void
  /**
   * External-change notification (another tab today, a server push tomorrow).
   * Receives the new nodes, or null when the storage was cleared externally.
   * Returns an unsubscribe function. Optional — stores that can't push
   * changes simply omit it.
   */
  subscribe?(onChange: (nodes: CavinNode<TAttr>[] | null) => void): () => void
}

/** In-memory storage: the default for tests and examples without persistence. */
export function createMemoryCavinStorage<TAttr>(): CavinStorage<TAttr> {
  let nodes: CavinNode<TAttr>[] | null = null
  const listeners = new Set<(nodes: CavinNode<TAttr>[] | null) => void>()
  return {
    load: () => (nodes && nodes.length > 0 ? nodes : null),
    save(next) {
      nodes = next
      return true
    },
    clear() {
      nodes = null
      for (const l of listeners) l(null)
    },
    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
  }
}

/** Validate an array of raw records through the adapter, dropping malformed
    entries (never throws). Shared by storage implementations. */
export function validateRecords<TAttr>(
  records: unknown,
  adapter: SchemaAdapter<TAttr>,
): CavinNode<TAttr>[] | null {
  if (!Array.isArray(records) || records.length === 0) return null
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
  if (nodes.length === 0) return null
  if (dropped > 0) {
    ;(globalThis as { console?: { warn: (...args: unknown[]) => void } }).console?.warn(
      `[cavin] dropped ${dropped} invalid persisted nodes`,
    )
  }
  return nodes
}
