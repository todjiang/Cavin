import { createContext, useContext } from 'react'
import type { CavinEdge, CavinNode, CavinStorage, SchemaAdapter } from '@cavin/core'
import { validateRecords } from '@cavin/core'
import type { ViewStore } from './view-store'
import type { WorldStore } from './world-store'

/**
 * Per-instance composition: one context per mounted canvas carrying the
 * adapter, the resolved config, and the two stores. Board/UI components
 * never import a singleton — they read their stores from here.
 */
export interface CavinContextValue<TAttr = unknown> {
  adapter: SchemaAdapter<TAttr>
  /** Optional HUD heading from the host. */
  title?: string
  view: ViewStore
  world: WorldStore<TAttr>
}

export const CavinContext = createContext<CavinContextValue | null>(null)

export function useCavin<TAttr>(): CavinContextValue<TAttr> {
  const ctx = useContext(CavinContext) as CavinContextValue<TAttr> | null
  if (!ctx) throw new Error('[cavin] CavinCanvas components must render inside <CavinCanvas>')
  return ctx
}

/* ------------------------------------------------------------------ */
/* localStorage persistence (DOM lives here, not in the core)          */
/* ------------------------------------------------------------------ */

/**
 * The doc's `createLocalStorageCavinStorage(key, adapter)`: localStorage-
 * backed node persistence, validated through `adapter.validate` per record
 * (fail-safe: quota, privacy mode, and corrupt payloads all behave as
 * empty). `fallbackKeys` are consulted when the primary key is empty — the
 * migration seam for hosts that previously persisted a legacy shape: the
 * same adapter.validate decodes old records into CavinNodes, and the next
 * save writes the new key.
 */
export function createLocalStorageCavinStorage<TAttr>(
  key: string,
  adapter: SchemaAdapter<TAttr>,
  opts: { fallbackKeys?: string[] } = {},
): CavinStorage<TAttr> {
  const parse = (raw: string | null): CavinNode<TAttr>[] | null => {
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const records = Array.isArray(parsed) ? parsed : parsed?.nodes
    return validateRecords(records, adapter)
  }
  const readAny = (): CavinNode<TAttr>[] | null => {
    try {
      const primary = parse(window.localStorage.getItem(key))
      if (primary) return primary
      for (const fallback of opts.fallbackKeys ?? []) {
        const legacy = parse(window.localStorage.getItem(fallback))
        if (legacy) return legacy
      }
      return null
    } catch (err) {
      console.warn('[cavin] failed to load persisted world', err)
      return null
    }
  }
  return {
    load: readAny,
    save(nodes) {
      try {
        window.localStorage.setItem(key, JSON.stringify(nodes))
        return true
      } catch (err) {
        console.warn('[cavin] failed to persist world', err)
        return false
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key)
        for (const fallback of opts.fallbackKeys ?? []) window.localStorage.removeItem(fallback)
      } catch (err) {
        console.warn('[cavin] failed to clear persisted world', err)
      }
    },
    subscribe(onChange) {
      const handler = (e: StorageEvent) => {
        if (e.key !== key) return
        try {
          onChange(parse(e.newValue))
        } catch (err) {
          console.warn('[cavin] failed to load externally-changed world', err)
        }
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}

/** localStorage persistence for the confirmed-edge list (the core's
    CavinStorage is node-only). Dangling edges are re-filtered at derive. */
export function createLocalStorageEdges(key: string): {
  load(): CavinEdge[] | null
  save(edges: CavinEdge[]): boolean
  clear(): void
} {
  return {
    load() {
      try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return null
        return parsed.filter(
          (e): e is CavinEdge =>
            !!e &&
            typeof e.id === 'string' &&
            typeof e.from === 'string' &&
            typeof e.to === 'string',
        )
      } catch (err) {
        console.warn('[cavin] failed to load persisted edges', err)
        return null
      }
    },
    save(edges) {
      try {
        window.localStorage.setItem(key, JSON.stringify(edges))
        return true
      } catch (err) {
        console.warn('[cavin] failed to persist edges', err)
        return false
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key)
      } catch (err) {
        console.warn('[cavin] failed to clear persisted edges', err)
      }
    },
  }
}
