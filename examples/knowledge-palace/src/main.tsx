import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CavinCanvas, createLocalStorageCavinStorage } from '@cavin/react'
import { LEGACY_STORAGE_KEY, PALACE_STORAGE_KEY, knowledgeAdapter, migrateV3Payload } from './adapter'
import { seedPalaceNodes } from './data'

// Snapshot persistence under the namespaced v4 key. The pre-framework
// `cavin-world-v3` flat payload is the migration fallback, decoded by
// migrateV3Payload; the next save writes only the new key. First-v4 installs
// (plain node array + `${key}:edges`) are read by the storage itself.
const storage = createLocalStorageCavinStorage(PALACE_STORAGE_KEY, knowledgeAdapter, {
  fallbackKeys: [LEGACY_STORAGE_KEY],
  decodeLegacy: migrateV3Payload,
})

// The seed is built once per mount; "reset demo" re-derives from it.
const seed = seedPalaceNodes()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CavinCanvas
      adapter={knowledgeAdapter}
      storage={storage}
      initialNodes={seed}
      title="memory palace"
      urlSync
      viewStorageKey="cavin-view-v1"
    />
  </StrictMode>,
)
