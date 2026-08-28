import { generateSanguoNodes } from './generate'
import { generateSanguoEdges } from './relations'
import { computePlacement } from './placement'
import type { SanguoNode } from './types'

/**
 * App data: the generator emits people at position [0,0] with no placement —
 * this assigns the example's deterministic slot/era layout: parents anchor
 * roots at their computed grid slots, children ride a relOffset around them
 * (re-derived identically after every reload).
 */
function hashRand(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildSanguoWorld(): { nodes: SanguoNode[]; confirmedEdges: ReturnType<typeof generateSanguoEdges> } {
  const raw = generateSanguoNodes()
  const placement = computePlacement(raw)
  const rand = hashRand(0x5a69)
  const gauss = () => (rand() + rand() + rand() - 1.5) * 2

  const byId = new Map<string, SanguoNode>()
  const nodes: SanguoNode[] = raw.map((n) => ({ ...n, attributes: { ...n.attributes } }))
  for (const n of nodes) {
    byId.set(n.id, n)
    if (n.parentId && byId.has(n.parentId)) {
      const parent = byId.get(n.parentId)!
      const relOffset: [number, number] = [gauss() * 18, gauss() * 18]
      n.state = { ...n.state, relOffset }
      n.position = [parent.position[0] + relOffset[0], parent.position[1] + relOffset[1]]
    } else {
      n.position = placement.get(n.id) ?? [0, 0]
    }
  }
  return { nodes, confirmedEdges: generateSanguoEdges() }
}
