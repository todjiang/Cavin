import type { ViewStore } from './view-store'
import type { WorldStore } from './world-store'

/**
 * The selection seam between the two stores. The world store never imports
 * the view store (per-instance rule): actions that create a node request
 * selection through the `onSelectRequest` callback the canvas injects — a
 * real call between two modules, not a one-producer/one-consumer bus stored
 * in world state.
 *
 * This module owns the invariants that couple the two stores' selection
 * state:
 * - a selectedId that disappears from the world (delete / reset) is cleared;
 * - `editingId` (world store) always equals `selectedId` (view store) —
 *   enforced HERE, centrally, instead of by `!==` comparisons at read sites:
 *   any selection change that leaves editingId pointing elsewhere closes the
 *   editor.
 */
export function syncSelection<TAttr>(view: ViewStore, world: WorldStore<TAttr>): () => void {
  const unworld = world.subscribe((s, prev) => {
    if (s.world !== prev.world) {
      const sel = view.getState().selectedId
      if (sel && !s.world.nodeById.has(sel)) view.getState().select(null)
    }
  })
  const unview = view.subscribe((s, prev) => {
    if (s.selectedId === prev.selectedId) return
    const w = world.getState()
    // Invariant: editingId must equal selectedId. Selecting something else
    // (or nothing) while the editor is open closes it — centrally, here.
    if (w.editingId !== s.selectedId && w.editingId !== null) w.setEditing(null)
  })
  return () => {
    unworld()
    unview()
  }
}
