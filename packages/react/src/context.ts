import { createContext, useContext } from 'react'
import type { CavinNode, CavinStorage, LayoutConfig, SchemaAdapter, WorldSnapshot } from '@cavin/core'
import { validateEdgeRecords, validateRecords } from '@cavin/core'
import type { ViewStore } from './view-store'
import type { WorldStore } from './world-store'
import type { FrameHolder } from './frame'
import type { Keymap } from './keymap'
import type { CavinRenderers } from './renderers'

/**
 * Per-instance composition: one context per mounted canvas carrying the
 * adapter, the RESOLVED config (defaults deep-merged with the host's
 * `config` prop), and the two stores. Board/UI components never import a
 * singleton — they read their stores and the config from here, so a
 * per-instance override reaches every render-time computation.
 */
export interface CavinContextValue<TAttr = unknown> {
  adapter: SchemaAdapter<TAttr>
  /** Optional HUD heading from the host. */
  title?: string
  /** The resolved LayoutConfig for this canvas (mergeConfig output). */
  config: LayoutConfig
  view: ViewStore
  world: WorldStore<TAttr>
  /** Per-canvas frame owner: focus-blend animation, viewport, shared Scene. */
  frame: FrameHolder
  /** The resolved hotkey bindings (defaults + host override). */
  keymap: Keymap
  /** Host renderer overrides; unset slots use the built-ins. */
  renderers?: CavinRenderers<TAttr>
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
 * localStorage-backed SNAPSHOT persistence — the whole editable state
 * (`{ nodes, confirmedEdges }`) under one key, validated through
 * `adapter.validate` per record (fail-safe: quota, privacy mode, and corrupt
 * payloads all behave as absent). Absent and empty are distinct: an emptied
 * world reloads empty, not as the seed.
 *
 * Backward compatibility, all automatic on first successful load:
 * - a plain node array (or `{ nodes }`) under the primary key — the first
 *   v4 shape — loads with confirmed edges from the sibling `${key}:edges`
 *   record when present;
 * - `fallbackKeys` (e.g. a pre-framework payload) go through `decodeLegacy`,
 *   the host's `(raw) → snapshot` migration function, before falling back
 *   to the standard parse. The next save writes only the new key.
 */
export function createLocalStorageCavinStorage<TAttr>(
  key: string,
  adapter: SchemaAdapter<TAttr>,
  opts: {
    fallbackKeys?: string[]
    /** Host migration seam for legacy payloads found under `fallbackKeys`:
        decode the raw parsed JSON into a current snapshot, or return null. */
    decodeLegacy?: (raw: unknown) => WorldSnapshot<TAttr> | null
  } = {},
): CavinStorage<TAttr> {
  const warn = (msg: string, err?: unknown) => console.warn(msg, err)

  const decodeNodes = (records: unknown): CavinNode<TAttr>[] | null => {
    const result = validateRecords(records, adapter)
    if (result && result.dropped > 0) {
      warn(`[cavin] dropped ${result.dropped} invalid persisted nodes`)
    }
    return result?.nodes ?? null
  }

  /** Parse one raw string into a snapshot. Accepts the snapshot shape, a
      bare node array (first v4 shape), and `{ nodes, edges }` (legacy v3). */
  const parse = (raw: string | null): WorldSnapshot<TAttr> | null => {
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const nodes = decodeNodes(parsed)
      return nodes ? { nodes, confirmedEdges: [] } : null
    }
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as { nodes?: unknown; confirmedEdges?: unknown; edges?: unknown }
      const nodes = decodeNodes(rec.nodes)
      if (!nodes) return null
      const confirmed = rec.confirmedEdges ?? rec.edges
      return { nodes, confirmedEdges: validateEdgeRecords(confirmed) }
    }
    return null
  }

  const readAny = (): WorldSnapshot<TAttr> | null => {
    try {
      const primary = parse(window.localStorage.getItem(key))
      if (primary) {
        // First-v4 installs kept confirmed edges in a sibling record.
        if (primary.confirmedEdges.length === 0) {
          try {
            const rawEdges = window.localStorage.getItem(`${key}:edges`)
            if (rawEdges) {
              primary.confirmedEdges = validateEdgeRecords(JSON.parse(rawEdges))
            }
          } catch (err) {
            warn('[cavin] failed to load persisted edges', err)
          }
        }
        return primary
      }
      for (const fallback of opts.fallbackKeys ?? []) {
        const raw = window.localStorage.getItem(fallback)
        if (!raw) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch (err) {
          warn('[cavin] failed to parse legacy payload', err)
          continue
        }
        const migrated = opts.decodeLegacy?.(parsed)
        if (migrated) return migrated
        const snap = parse(raw)
        if (snap) return snap
      }
      return null
    } catch (err) {
      warn('[cavin] failed to load persisted world', err)
      return null
    }
  }

  return {
    load: readAny,
    save(snapshot) {
      try {
        window.localStorage.setItem(key, JSON.stringify(snapshot))
        return true
      } catch (err) {
        warn('[cavin] failed to persist world', err)
        return false
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key)
        window.localStorage.removeItem(`${key}:edges`)
        for (const fallback of opts.fallbackKeys ?? []) {
          window.localStorage.removeItem(fallback)
        }
      } catch (err) {
        warn('[cavin] failed to clear persisted world', err)
      }
    },
    subscribe(onChange) {
      const handler = (e: StorageEvent) => {
        if (e.key !== key) return
        try {
          onChange(parse(e.newValue))
        } catch (err) {
          warn('[cavin] failed to load externally-changed world', err)
        }
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}
