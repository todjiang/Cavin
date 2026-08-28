import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CavinCanvas, createLocalStorageCavinStorage, createLocalStorageEdges } from '@cavin/react'
import {
  LEGACY_STORAGE_KEY,
  PALACE_STORAGE_KEY,
  knowledgeAdapter,
  migrateV3Edges,
} from './adapter'
import { seedPalaceNodes } from './data'

// Persistence: v4 nodes keyed by the namespaced storage key; the pre-framework
// `cavin-world-v3` flat payload is the migration fallback — adapter.validate
// decodes old records, and the next save writes only the new key.
const storage = createLocalStorageCavinStorage(PALACE_STORAGE_KEY, knowledgeAdapter, {
  fallbackKeys: [LEGACY_STORAGE_KEY],
})
const edgesStore = {
  ...createLocalStorageEdges(`${PALACE_STORAGE_KEY}:edges`),
  // First boot on a pre-framework install: confirmed edges ride the legacy
  // v3 payload; suggested ones are always re-derived.
  load() {
    const fresh = createLocalStorageEdges(`${PALACE_STORAGE_KEY}:edges`).load()
    if (fresh) return fresh
    try {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
      return legacy ? migrateV3Edges(JSON.parse(legacy)) : null
    } catch {
      return null
    }
  },
}

// The seed is built once per mount; "reset demo" re-derives from it.
const seed = seedPalaceNodes()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CavinCanvas
      adapter={knowledgeAdapter}
      storage={storage}
      edgesStore={edgesStore}
      initialNodes={seed}
      title="memory palace"
      urlSync
      viewStorageKey="cavin-view-v1"
    />
  </StrictMode>,
)
