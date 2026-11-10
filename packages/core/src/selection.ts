import type { SelectionFocus, World } from './types'

/**
 * The selection spotlight set: the selected node, the other ends of its
 * confirmed edges, plus its tree context (children and the ancestor chain —
 * a node's place stays visible while its relations light up).
 * Returns null when there is no selection or the node has no confirmed
 * edges; callers fall back to the plain (non-isolating) spotlight then.
 */
export function focusForSelection<TAttr>(
  world: World<TAttr>,
  selectedId: string | null,
): SelectionFocus | null {
  if (!selectedId || !world.nodeById.has(selectedId)) return null
  const edgeIds = new Set<string>()
  const ringIds = new Set<string>()
  const nodeIds = new Set<string>([selectedId])
  for (const e of world.edgesByNode.get(selectedId) ?? []) {
    if (e.kind !== 'confirmed') continue
    edgeIds.add(e.id)
    const other = e.from === selectedId ? e.to : e.from
    ringIds.add(other)
    nodeIds.add(other)
  }
  if (edgeIds.size === 0) return null
  const childIds: string[] = []
  for (const c of world.childrenByParent.get(selectedId) ?? []) {
    nodeIds.add(c.id)
    if (!c.state.placed && !ringIds.has(c.id)) childIds.push(c.id)
  }
  let cur = world.nodeById.get(selectedId)
  while (cur?.parentId) {
    nodeIds.add(cur.parentId)
    cur = world.nodeById.get(cur.parentId)
  }
  return { id: selectedId, nodeIds, edgeIds, ringIds, childIds }
}
