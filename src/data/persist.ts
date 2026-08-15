import type { LaidOutNode } from './layout'

/**
 * Persistence behind an interface. The world store talks to `WorldStorage`
 * only — the default implementation is localStorage, but a future backend or
 * CRDT sync layer can be swapped in (e.g. via `setWorldStorage`) without
 * touching the store or any UI. Only the node array crosses the boundary;
 * rooms/wings/maps are re-derived on load. All implementations must be
 * fail-safe (quota, privacy mode, corrupt payloads → behave as empty).
 */
export interface WorldStorage {
  /** Restore the persisted node array, or null when absent/corrupt. */
  load(): LaidOutNode[] | null
  /** Returns true on success; false when the save was rejected (quota/privacy). */
  save(nodes: LaidOutNode[]): boolean
  clear(): void
  /**
   * External-change notification (another tab today, a server push tomorrow).
   * Receives the new node array, or null when the storage was cleared
   * externally. Returns an unsubscribe function. Optional — stores that can't
   * push changes simply omit it.
   */
  subscribe?(onChange: (nodes: LaidOutNode[] | null) => void): () => void
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Per-node schema check — drops records that would yield NaN geometry. */
function validNode(n: any): n is LaidOutNode {
  return (
    !!n &&
    typeof n.id === 'string' &&
    typeof n.title === 'string' &&
    typeof n.wingId === 'string' &&
    typeof n.roomId === 'string' &&
    Array.isArray(n.position) &&
    isFiniteNum(n.position[0]) &&
    isFiniteNum(n.position[1])
  )
}

/** Validate a raw payload into a node array, dropping malformed records. */
function parseNodes(raw: string | null): LaidOutNode[] | null {
  if (!raw) return null
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed) || parsed.length === 0) return null
  const valid = parsed.filter(validNode)
  if (valid.length === 0) return null
  if (valid.length !== parsed.length) {
    console.warn(`[cavin] dropped ${parsed.length - valid.length} invalid persisted nodes`)
  }
  return valid
}

const DEFAULT_KEY = 'cavin-world-v2'

/** localStorage-backed storage; also listens for cross-tab `storage` events. */
export function createLocalStorageWorldStorage(key = DEFAULT_KEY): WorldStorage {
  return {
    load() {
      try {
        return parseNodes(window.localStorage.getItem(key))
      } catch (err) {
        console.warn('[cavin] failed to load persisted world', err)
        return null
      }
    },
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
      } catch (err) {
        console.warn('[cavin] failed to clear persisted world', err)
      }
    },
    subscribe(onChange) {
      const handler = (e: StorageEvent) => {
        if (e.key !== key) return
        try {
          onChange(parseNodes(e.newValue))
        } catch (err) {
          console.warn('[cavin] failed to load externally-changed world', err)
        }
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}

/** The storage the world store uses. Swappable for tests or a future backend. */
export let worldStorage: WorldStorage = createLocalStorageWorldStorage()

export function setWorldStorage(storage: WorldStorage): void {
  worldStorage = storage
}
