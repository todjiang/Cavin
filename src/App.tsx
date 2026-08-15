import { useEffect } from 'react'
import { Board } from './board/Board'
import { Minimap } from './board/Minimap'
import { Hud } from './ui/Hud'
import { DetailPanel } from './ui/DetailPanel'
import { SearchBox } from './ui/SearchBox'
import { ToastStack } from './ui/Toast'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { useViewStore } from './store'
import { useWorldStore } from './store/world'

export default function App() {
  // Bridge between the world and view stores, wired here at the composition
  // root so the stores never import each other:
  // - world actions that need a selection change (add note/child) set
  //   `requestedSelection`; we apply it to the view store.
  // - whenever the world changes, a selectedId that no longer exists
  //   (deleted, or wiped by the demo reset) is cleared.
  useEffect(() => {
    return useWorldStore.subscribe((s, prev) => {
      if (s.requestedSelection && s.requestedSelection !== prev.requestedSelection) {
        useViewStore.getState().select(s.requestedSelection.id)
      }
      if (s.world !== prev.world) {
        const sel = useViewStore.getState().selectedId
        if (sel && !s.world.nodeById.has(sel)) useViewStore.getState().select(null)
      }
    })
  }, [])

  return (
    <ErrorBoundary>
      <div className="app">
        <Board />
        <Hud />
        <SearchBox />
        <Minimap />
        <DetailPanel />
        <ToastStack />
      </div>
    </ErrorBoundary>
  )
}
