import { createContext, useContext } from 'react'
import type { CavinStorage, LayoutConfig, SchemaAdapter, WorldSnapshot } from '@cavin/core'
import { decodeSnapshot, validateEdgeRecords } from '@cavin/core'
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
 * (`{ nodes, confirmedEdges }`) under one key. Record-shape policy (bare
 * array, `{ nodes }`, snapshot, legacy alias) lives in the core's
 * `decodeSnapshot`; this adapter keeps only what is genuinely DOM/host
 * policy: JSON, key access, the first-v4 sibling `:edges` record, fallback
 * keys, and the host's legacy migration seam. Fail-safe by contract: quota,
 * privacy mode, and corrupt payloads all behave as absent. Absent and empty
 * are distinct: an emptied world reloads empty, not as the seed.
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

  /** Decode one raw string into a snapshot via the core decoder. Returns
      null for absent/corrupt payloads. */
  const parse = (raw: string | null): WorldSnapshot<TAttr> | null => {
    if (!raw) return null
    const decoded = decodeSnapshot(JSON.parse(raw), adapter)
    if (!decoded) return null
    if (decoded.droppedNodes > 0) {
      warn(`[cavin] dropped ${decoded.droppedNodes} invalid persisted nodes`)
    }
    return decoded.snapshot
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
              // The sibling record is a bare edge array, not a snapshot.
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
