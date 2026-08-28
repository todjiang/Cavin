import { describe, expect, it } from 'vitest'
import type { CavinEdge } from './edges'
import { applyCommand, applyDragFrame } from './commands'
import { deriveWorld } from './layout'
import { family, makeNode, testAdapter } from './test-helpers'
import type { TestAttrs } from './test-helpers'
import type { World } from './types'

/**
 * Command-layer invariants: every edit flows through applyCommand, so the
 * guarantees here hold for the UI and any headless script alike — the input
 * world is never mutated, locked nodes are untouchable, reparenting can
 * never create a cycle, and removal shields locked branches.
 */

function boot(nodes = family()): World<TestAttrs> {
  return deriveWorld(nodes, testAdapter)
}

function snapshot(world: World<TestAttrs>): string {
  return JSON.stringify([
    world.nodes,
    [...world.degreeById],
    world.groups.map((g) => [g.id, g.centroid, g.count]),
  ])
}

const confirmed = (world: World<TestAttrs>): CavinEdge[] =>
  world.edges.filter((e) => e.kind === 'confirmed')

describe('applyCommand', () => {
  it('never mutates the input world', () => {
    const world = boot()
    const before = snapshot(world)
    applyCommand(world, { type: 'add', at: [0, 0] }, testAdapter)
    applyCommand(world, { type: 'addChild', parentId: 'a' }, testAdapter)
    applyCommand(world, { type: 'update', id: 'a', patch: { title: 'edited' } }, testAdapter)
    applyCommand(world, { type: 'move', id: 'a', to: [5, 5] }, testAdapter)
    applyCommand(world, { type: 'reparent', id: 'b', newParentId: 'd' }, testAdapter)
    applyCommand(world, { type: 'promote', id: 'b' }, testAdapter)
    applyCommand(world, { type: 'remove', id: 'b' }, testAdapter)
    expect(snapshot(world)).toBe(before)
  })

  it('add creates a placed root in the nearest deepest group', () => {
    const world = boot()
    // Near d's cluster → Design/Typography; ungrouped worlds → empty path.
    const res = applyCommand(world, { type: 'add', at: [890, 900] }, testAdapter)
    expect(res.ok).toBe(true)
    const created = res.world!.nodeById.get(res.createdId!)!
    expect(created.groupPath).toEqual(['Design', 'Typography'])
    expect(created.state.placed).toBe(true)
  })

  it('addChild creates an unplaced child in the parent’s group', () => {
    const world = boot()
    const res = applyCommand(world, { type: 'addChild', parentId: 'a' }, testAdapter, undefined, () => 0)
    expect(res.ok).toBe(true)
    const child = res.world!.nodeById.get(res.createdId!)!
    expect(child.parentId).toBe('a')
    expect(child.groupPath).toEqual(['ML', 'Optimizers'])
    expect(child.state.placed).toBeUndefined()
    expect(child.state.relOffset).toBeDefined()
    // The child rides the parent via derive normalization.
    expect(child.position).toEqual([
      world.nodeById.get('a')!.position[0] + child.state.relOffset![0],
      world.nodeById.get('a')!.position[1] + child.state.relOffset![1],
    ])
  })

  it('update merges into attributes; locked notes refuse it', () => {
    const world = boot()
    const res = applyCommand(world, { type: 'update', id: 'a', patch: { title: 'New' } }, testAdapter)
    expect(res.world!.nodeById.get('a')!.attributes.title).toBe('New')

    const locked = boot(family().map((n) => (n.id === 'a' ? { ...n, state: { ...n.state, locked: true } } : n)))
    expect(applyCommand(locked, { type: 'update', id: 'a', patch: { title: 'X' } }, testAdapter)).toMatchObject({
      ok: false,
      error: 'locked-node',
    })
  })

  it('locked nodes refuse move, reparent, removal — and shield their subtree', () => {
    const nodes = family().map((n) =>
      n.id === 'a' ? { ...n, state: { ...n.state, locked: true } } : n,
    )
    const world = boot(nodes)
    expect(applyCommand(world, { type: 'move', id: 'a', to: [1, 1] }, testAdapter).error).toBe('locked-node')
    expect(applyCommand(world, { type: 'reparent', id: 'a', newParentId: 'd' }, testAdapter).error).toBe('locked-node')
    expect(applyCommand(world, { type: 'remove', id: 'a' }, testAdapter).error).toBe('locked-node')

    // Lock b (mid-tree): deleting a removes a only — b shields c.
    const midLocked = boot(family().map((n) => (n.id === 'b' ? { ...n, state: { ...n.state, locked: true } } : n)))
    const res = applyCommand(midLocked, { type: 'remove', id: 'a' }, testAdapter)
    expect(res.notice).toEqual({ kind: 'deleted', count: 1 })
    expect(res.world!.nodeById.has('b')).toBe(true)
  })

  it('reparent refuses cycles; the store-visible flow stays pure', () => {
    const world = boot()
    expect(
      applyCommand(world, { type: 'reparent', id: 'a', newParentId: 'c' }, testAdapter),
    ).toMatchObject({ ok: false, error: 'cycle' })
  })

  it('remove prunes confirmed edges of the doomed subtree', () => {
    let world = boot()
    const edge: CavinEdge = { id: 'mine', from: 'a', to: 'd', createdAt: 1 }
    world = applyCommand(world, { type: 'confirmEdge', edge }, testAdapter).world!
    expect(confirmed(world)).toHaveLength(1)

    const res = applyCommand(world, { type: 'remove', id: 'a' }, testAdapter)
    expect(res.edges).toEqual([]) // the confirmed edge died with a
    expect(res.world!.edges.every((e) => e.id !== 'mine')).toBe(true)
  })

  it('setLocked sets locked and confirmed together (locking IS confirming)', () => {
    const world = boot()
    const res = applyCommand(world, { type: 'setLocked', id: 'a', locked: true }, testAdapter)
    expect(res.world!.nodeById.get('a')!.state).toMatchObject({ locked: true, confirmed: true })
  })

  it('move uses the frame fast path for placed nodes (no re-derive)', () => {
    const world = boot()
    // First move detaches from orbit — structural.
    const first = applyCommand(world, { type: 'move', id: 'b', to: [500, 100] }, testAdapter)
    expect(first.world!.nodeById.get('b')!.state.placed).toBe(true)
    const structural = first.world!
    // Second move is a positional patch: the world object keeps its identity fields.
    const second = applyCommand(structural, { type: 'move', id: 'b', to: [510, 100] }, testAdapter)
    expect(second.world!.nodeById.get('b')!.position).toEqual([510, 100])
    expect(second.world!.groups).toBe(structural.groups) // untouched by the frame path
  })
})

describe('applyDragFrame', () => {
  it('moves the placed node and its movable subtree, nothing else', () => {
    const world = boot()
    const placed = applyCommand(world, { type: 'move', id: 'b', to: [400, 400] }, testAdapter).world!
    const b = placed.nodeById.get('b')!
    const c = placed.nodeById.get('c')!
    const delta: [number, number] = [10, -5]
    const framed = applyDragFrame(placed, 'b', [b.position[0] + 10, b.position[1] - 5])!
    expect(framed.nodeById.get('b')!.position).toEqual([b.position[0] + 10, b.position[1] - 5])
    expect(framed.nodeById.get('c')!.position).toEqual([c.position[0] + 10, c.position[1] - 5])
    expect(framed.nodeById.get('a')!.position).toEqual(world.nodeById.get('a')!.position)
    expect(delta).toEqual([10, -5]) // self-check of the arithmetic above
  })

  it('returns null for unplaced or unknown nodes and zero deltas', () => {
    const world = boot()
    expect(applyDragFrame(world, 'b', [0, 0])).toBeNull() // unplaced
    expect(applyDragFrame(world, 'ghost', [1, 1])).toBeNull()
    const placed = applyCommand(world, { type: 'move', id: 'b', to: [400, 400] }, testAdapter).world!
    const pos = placed.nodeById.get('b')!.position
    expect(applyDragFrame(placed, 'b', [pos[0], pos[1]])).toBeNull() // zero delta
  })

  it('makeNode is part of the fixture contract', () => {
    expect(makeNode({ id: 'x' }).groupPath).toEqual(['ML', 'Optimizers'])
  })
})
