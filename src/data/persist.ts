import type { LaidOutNode } from './layout'
import type { CavinEdge } from './edges'

/**
 * Persistence behind an interface. The world store talks to `WorldStorage`
 * only — the default implementation is localStorage, but a future backend or
 * CRDT sync layer can be swapped in (e.g. via `setWorldStorage`) without
 * touching the store or any UI. Only the node array plus the confirmed-edge
 * list cross the boundary; rooms/wings/maps and suggested edges are
 * re-derived on load. All implementations must be fail-safe (quota, privacy
 * mode, corrupt payloads → behave as empty).
 */
export interface WorldPayload {
  nodes: LaidOutNode[]
  /** Human-confirmed cross-domain connections; suggested edges are derived
      at load and never persisted. */
  edges: CavinEdge[]
}

export interface WorldStorage {
  /** Restore the persisted payload, or null when absent/corrupt. */
  load(): WorldPayload | null
  /** Returns true on success; false when the save was rejected (quota/privacy). */
  save(nodes: LaidOutNode[], edges: CavinEdge[]): boolean
  clear(): void
  /**
   * External-change notification (another tab today, a server push tomorrow).
   * Receives the new payload, or null when the storage was cleared
   * externally. Returns an unsubscribe function. Optional — stores that can't
   * push changes simply omit it.
   */
  subscribe?(onChange: (payload: WorldPayload | null) => void): () => void
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

/** Per-edge schema check — loose on purpose: dangling endpoints are filtered
    at derive time (edges are weak references). */
function validEdge(e: any): e is CavinEdge {
  return (
    !!e &&
    typeof e.id === 'string' &&
    typeof e.from === 'string' &&
    typeof e.to === 'string'
  )
}

/** Validate a raw payload into nodes + edges, dropping malformed records.
    Accepts the legacy v2 shape (a bare node array → no edges). */
function parsePayload(raw: string | null): WorldPayload | null {
  if (!raw) return null
  const parsed = JSON.parse(raw)
  const rawNodes = Array.isArray(parsed) ? parsed : parsed?.nodes
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) return null
  const nodes = rawNodes.filter(validNode)
  if (nodes.length === 0) return null
  if (nodes.length !== rawNodes.length) {
    console.warn(`[cavin] dropped ${rawNodes.length - nodes.length} invalid persisted nodes`)
  }
  const rawEdges = Array.isArray(parsed) ? [] : parsed?.edges
  const edges: CavinEdge[] = Array.isArray(rawEdges) ? rawEdges.filter(validEdge) : []
  return { nodes, edges }
}

const DEFAULT_KEY = 'cavin-world-v3'

/** localStorage-backed storage; also listens for cross-tab `storage` events. */
export function createLocalStorageWorldStorage(key = DEFAULT_KEY): WorldStorage {
  return {
    load() {
      try {
        return parsePayload(window.localStorage.getItem(key))
      } catch (err) {
        console.warn('[cavin] failed to load persisted world', err)
        return null
      }
    },
    save(nodes, edges) {
      try {
        window.localStorage.setItem(key, JSON.stringify({ nodes, edges }))
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
          onChange(parsePayload(e.newValue))
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
