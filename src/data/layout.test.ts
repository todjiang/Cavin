import { describe, expect, it } from 'vitest'
import type { LaidOutNode } from './layout'
import {
  deletableSubtree,
  deriveWorld,
  movableSubtree,
  promoteToRootNodes,
  reparentNodes,
} from './layout'

/**
 * Pure data-layer tests: the refinement rules a curator relies on —
 * orphan promotion, child re-anchoring, lock shielding, cycle-safe
 * re-parenting, and promote-to-root. No DOM, no store.
 */

function makeNode(partial: Partial<LaidOutNode> & { id: string }): LaidOutNode {
  return {
    wingId: 'wing-0',
    wingName: 'ML',
    roomId: 'wing-0-room-0',
    roomName: 'Optimizers',
    title: partial.id,
    body: '',
    tags: [],
    embedding: [1, 0, 0, 0, 0, 0, 0, 0],
    createdAt: 0,
    position: [0, 0],
    color: 'hsl(15, 70%, 62%)',
    hue: 15,
    ...partial,
  }
}

/** a(root) → b → c, d(root in another room) */
function family(): LaidOutNode[] {
  return [
    makeNode({ id: 'a', position: [100, 100] }),
    makeNode({ id: 'b', parentId: 'a', relOffset: [10, 0], position: [110, 100], createdAt: 1 }),
    makeNode({ id: 'c', parentId: 'b', relOffset: [0, 10], position: [110, 110], createdAt: 2 }),
    makeNode({
      id: 'd',
      roomId: 'wing-1-room-0',
      roomName: 'Typography',
      wingId: 'wing-1',
      wingName: 'Design',
      position: [900, 900],
    }),
  ]
}

describe('deriveWorld', () => {
  it('promotes children with a missing parent to roots', () => {
    const nodes = [makeNode({ id: 'orphan', parentId: 'ghost', relOffset: [5, 5] })]
    const world = deriveWorld(nodes)
    const orphan = world.nodeById.get('orphan')!
    expect(orphan.parentId).toBeUndefined()
    expect(world.depthById.get('orphan')).toBe(0)
  })

  it('re-anchors unplaced children to their parent position', () => {
    const nodes = family().map((n) =>
      n.id === 'a' ? { ...n, position: [500, 500] as [number, number] } : n,
    )
    const world = deriveWorld(nodes)
    // b rides a + relOffset; c rides b + its own relOffset.
    expect(world.nodeById.get('b')!.position).toEqual([510, 500])
    expect(world.nodeById.get('c')!.position).toEqual([510, 510])
  })

  it('computes nesting depth along the chain', () => {
    const world = deriveWorld(family())
    expect(world.depthById.get('a')).toBe(0)
    expect(world.depthById.get('b')).toBe(1)
    expect(world.depthById.get('c')).toBe(2)
  })
})

describe('deletableSubtree / movableSubtree', () => {
  it('a locked node shields itself and its whole branch', () => {
    const nodes = family().map((n) => (n.id === 'b' ? { ...n, locked: true } : n))
    const world = deriveWorld(nodes)
    // Deleting a removes a only — b is locked and shields c.
    expect([...deletableSubtree(world, 'a')].sort()).toEqual(['a'])
    expect([...movableSubtree(world, 'a')].sort()).toEqual(['a'])
  })

  it('includes the full subtree when nothing is locked', () => {
    const world = deriveWorld(family())
    expect([...deletableSubtree(world, 'a')].sort()).toEqual(['a', 'b', 'c'])
    // Unrelated roots are never included.
    expect(deletableSubtree(world, 'a').has('d')).toBe(false)
  })
})

describe('reparentNodes', () => {
  it('re-parents under a new parent and inherits its wing/room context', () => {
    const res = reparentNodes(family(), 'b', 'd', () => 0.5)
    expect(res.ok).toBe(true)
    const b = res.nodes!.find((n) => n.id === 'b')!
    expect(b.parentId).toBe('d')
    expect(b.placed).toBe(false)
    expect(b.roomId).toBe('wing-1-room-0')
    // The movable subtree crosses with it.
    const c = res.nodes!.find((n) => n.id === 'c')!
    expect(c.roomId).toBe('wing-1-room-0')
    // Unrelated nodes are untouched.
    expect(res.nodes!.find((n) => n.id === 'a')!.roomId).toBe('wing-0-room-0')
  })

  it('refuses to nest a note inside its own descendant', () => {
    const res = reparentNodes(family(), 'a', 'c')
    expect(res.ok).toBe(false)
    expect(res.error).toBe('cycle')
  })

  it('refuses locked nodes and locked targets', () => {
    const lockedB = family().map((n) => (n.id === 'b' ? { ...n, locked: true } : n))
    expect(reparentNodes(lockedB, 'b', 'd').error).toBe('locked-node')
    expect(reparentNodes(lockedB, 'a', 'b').error).toBe('locked-target')
  })

  it('a locked branch inside the subtree does not cross over', () => {
    const lockedC = family().map((n) => (n.id === 'c' ? { ...n, locked: true } : n))
    const res = reparentNodes(lockedC, 'b', 'd', () => 0.5)
    expect(res.ok).toBe(true)
    expect(res.nodes!.find((n) => n.id === 'c')!.roomId).toBe('wing-0-room-0')
  })

  it('dropping a free-placed child back on its parent re-joins the orbit', () => {
    const placed = family().map((n) => (n.id === 'b' ? { ...n, placed: true } : n))
    const res = reparentNodes(placed, 'b', 'a')
    expect(res.ok).toBe(true)
    expect(res.kind).toBe('rejoined')
    expect(res.nodes!.find((n) => n.id === 'b')!.placed).toBe(false)
  })

  it('is a noop when the node already sits under the target unplaced', () => {
    const res = reparentNodes(family(), 'b', 'a')
    expect(res.ok).toBe(false)
    expect(res.error).toBe('noop')
  })
})

describe('promoteToRootNodes', () => {
  it('breaks the parent link, pins the position, keeps the children', () => {
    const res = promoteToRootNodes(family(), 'b')
    expect(res.ok).toBe(true)
    const b = res.nodes!.find((n) => n.id === 'b')!
    expect(b.parentId).toBeUndefined()
    expect(b.placed).toBe(true)
    // c still belongs to b.
    const world = deriveWorld(res.nodes!)
    expect(world.nodeById.get('c')!.parentId).toBe('b')
    expect(world.depthById.get('b')).toBe(0)
    expect(world.depthById.get('c')).toBe(1)
  })

  it('refuses locked nodes and is a noop for roots', () => {
    const locked = family().map((n) => (n.id === 'b' ? { ...n, locked: true } : n))
    expect(promoteToRootNodes(locked, 'b').error).toBe('locked-node')
    expect(promoteToRootNodes(family(), 'a').error).toBe('noop')
  })
})
