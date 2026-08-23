import { describe, expect, it } from 'vitest'
import type { LaidOutNode } from './layout'
import {
  deletableSubtree,
  deriveWorld,
  focusForSelection,
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

describe('deriveWorld edges', () => {
  // family(): a, b, c in wing ML; d in wing Design — every node shares the
  // same unit embedding, so all three ML↔Design pairs suggest at sim 1.
  it('derives suggested cross-domain edges from layout vectors', () => {
    const world = deriveWorld(family())
    expect(world.edges).toHaveLength(3)
    expect(world.edges.every((e) => e.kind === 'suggested')).toBe(true)
    expect(world.edges.every((e) => e.id.startsWith('sugg:'))).toBe(true)
    expect(world.edgesByNode.get('d')).toHaveLength(3)
    expect(world.edgesByNode.get('a')).toHaveLength(1)
  })

  it('a confirmed edge shadows its suggestion; dangling edges are dropped', () => {
    const confirmed = [
      { id: 'mine', from: 'c', to: 'd', createdAt: 1 },
      { id: 'dead', from: 'a', to: 'ghost', createdAt: 1 },
    ]
    const world = deriveWorld(family(), undefined, confirmed)
    expect(world.edges).toHaveLength(3)
    expect(world.edges.find((e) => e.id === 'mine')!.kind).toBe('confirmed')
    expect(world.edges.some((e) => e.id === 'dead')).toBe(false)
    // c–d appears exactly once — the confirmed edge, not both kinds.
    const cd = world.edges.filter(
      (e) => [e.from, e.to].sort().join('') === ['c', 'd'].join(''),
    )
    expect(cd).toHaveLength(1)
    expect(cd[0].id).toBe('mine')
  })

  it('ranks nodes by connection degree (importance)', () => {
    const confirmed = [{ id: 'mine', from: 'c', to: 'd', createdAt: 1 }]
    const world = deriveWorld(family(), undefined, confirmed)
    // d touches sugg a–d, sugg b–d and confirmed c–d; each ML node touches one.
    expect(world.degreeById.get('d')).toBe(3)
    expect(world.degreeById.get('a')).toBe(1)
    expect(world.degreeById.get('c')).toBe(1) // confirmed shadows its suggestion
    expect(world.maxDegree).toBe(3)
  })

  it('reports zero degree for an edge-less world', () => {
    const world = deriveWorld([makeNode({ id: 'x' })])
    expect(world.maxDegree).toBe(0)
    expect(world.degreeById.size).toBe(0)
  })
})

describe('focusForSelection', () => {
  const confirmed = [{ id: 'mine', from: 'a', to: 'd', createdAt: 1 }]

  it('is null without a selection, an unknown id, or no confirmed edges', () => {
    const world = deriveWorld(family(), undefined, confirmed)
    expect(focusForSelection(world, null)).toBeNull()
    expect(focusForSelection(world, 'ghost')).toBeNull()
    // b has only a suggested edge — no focus mode.
    expect(focusForSelection(world, 'b')).toBeNull()
  })

  it('contains the confirmed neighbors plus tree context', () => {
    const world = deriveWorld(family(), undefined, confirmed)
    const focus = focusForSelection(world, 'a')!
    expect(focus.edgeIds).toEqual(new Set(['mine']))
    // a itself, its confirmed neighbor d, and its child b — but not the
    // grandchild c (only direct tree context stays).
    expect(focus.nodeIds.has('a')).toBe(true)
    expect(focus.nodeIds.has('d')).toBe(true)
    expect(focus.nodeIds.has('b')).toBe(true)
    expect(focus.nodeIds.has('c')).toBe(false)
    // The constellation ring holds confirmed neighbors only — no tree context.
    expect(focus.ringIds).toEqual(new Set(['d']))
    // The inner ring holds unplaced direct children, oldest first — placed
    // children stay home, and a child that is also a confirmed neighbor
    // joins the outer ring instead.
    expect(focus.childIds).toEqual(['b'])
  })

  it('a child that is also a confirmed neighbor stays on the outer ring', () => {
    const world = deriveWorld(family(), undefined, [
      { id: 'mine', from: 'a', to: 'd', createdAt: 1 },
      { id: 'kin', from: 'a', to: 'b', createdAt: 2 },
    ])
    const focus = focusForSelection(world, 'a')!
    expect(focus.ringIds).toEqual(new Set(['d', 'b']))
    expect(focus.childIds).toEqual([])
  })

  it('keeps the ancestor chain when the selection is nested', () => {
    const world = deriveWorld(family(), undefined, [{ id: 'mine', from: 'c', to: 'd', createdAt: 1 }])
    const focus = focusForSelection(world, 'c')!
    expect(focus.nodeIds.has('c')).toBe(true)
    expect(focus.nodeIds.has('d')).toBe(true)
    expect(focus.nodeIds.has('b')).toBe(true) // parent
    expect(focus.nodeIds.has('a')).toBe(true) // grandparent
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
