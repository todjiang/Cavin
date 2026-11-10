import { describe, expect, it } from 'vitest'
import type { SchemaAdapter } from './adapter'
import type { CavinEdge } from './edges'
import { applyCommand } from './commands'
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

const semanticAdapter: SchemaAdapter<TestAttrs> = {
  ...testAdapter,
  ontology: {
    context: { ex: 'https://example.test/ontology#' },
    nodeBaseIri: 'https://example.test/instances/',
    classes: [
      { id: 'Person', iri: 'ex:Person', label: 'Person' },
      { id: 'Ruler', iri: 'ex:Ruler', label: 'Ruler', parent: 'Person' },
    ],
    relations: [
      { id: 'hasRetainer', iri: 'ex:hasRetainer', label: 'has retainer', domain: 'Ruler', range: 'Person' },
      { id: 'mentorOf', iri: 'ex:mentorOf', label: 'mentor of', domain: 'Person', range: 'Person' },
    ],
  },
  typeOf: (n) => (n.id === 'a' ? 'Ruler' : 'Person'),
}

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
    expect(confirmed(res.world!)).toEqual([]) // the confirmed edge died with a
    expect(res.world!.edges.every((e) => e.id !== 'mine')).toBe(true)
  })

  it('connect validates semantic endpoints and never duplicates a triple', () => {
    const world = boot()
    const created = applyCommand(
      world,
      { type: 'connect', from: 'a', to: 'd', predicate: 'hasRetainer' },
      semanticAdapter,
    )
    expect(created.ok).toBe(true)
    expect(confirmed(created.world!)).toHaveLength(1)
    expect(confirmed(created.world!)[0]).toMatchObject({
      from: 'a',
      to: 'd',
      predicate: 'hasRetainer',
      label: 'has retainer',
    })

    const duplicate = applyCommand(
      created.world!,
      { type: 'connect', from: 'a', to: 'd', predicate: 'hasRetainer' },
      semanticAdapter,
    )
    expect(duplicate).toEqual({ ok: true })

    const before = confirmed(world)
    const invalid = applyCommand(
      world,
      { type: 'connect', from: 'd', to: 'a', predicate: 'hasRetainer' },
      semanticAdapter,
    )
    expect(invalid).toEqual({ ok: false, error: 'invalid-domain' })
    expect(invalid.world).toBeUndefined()
    expect(confirmed(world)).toEqual(before)
  })

  it('confirmEdge preserves predicates and shares semantic validation', () => {
    const world = boot()
    const typed: CavinEdge = {
      id: 'typed',
      from: 'a',
      to: 'd',
      createdAt: 1,
      predicate: 'mentorOf',
    }
    const confirmedResult = applyCommand(world, { type: 'confirmEdge', edge: typed }, semanticAdapter)
    expect(confirmed(confirmedResult.world!)).toEqual([
      { ...typed, kind: 'confirmed' },
    ])

    const invalid = applyCommand(
      world,
      { type: 'confirmEdge', edge: { ...typed, predicate: 'ghost' } },
      semanticAdapter,
    )
    expect(invalid).toEqual({ ok: false, error: 'unknown-predicate' })
  })

  it('setLocked sets locked and confirmed together (locking IS confirming)', () => {
    const world = boot()
    const res = applyCommand(world, { type: 'setLocked', id: 'a', locked: true }, testAdapter)
    expect(res.world!.nodeById.get('a')!.state).toMatchObject({ locked: true, confirmed: true })
  })

  it('move detaches on the first move, then re-derives every index per frame', () => {
    const world = boot()
    // First move detaches from orbit — structural.
    const first = applyCommand(world, { type: 'move', id: 'b', to: [500, 100] }, testAdapter)
    expect(first.world!.nodeById.get('b')!.state.placed).toBe(true)
    const structural = first.world!
    // Second move is a positional patch, but still a FULL re-derive: the
    // world may never carry a stale index (childrenByParent, groups) that
    // disagrees with nodeById.
    const second = applyCommand(structural, { type: 'move', id: 'b', to: [510, 100] }, testAdapter)
    expect(second.world!.nodeById.get('b')!.position).toEqual([510, 100])
    expect(second.world!.groups).not.toBe(structural.groups)
    // Every index agrees: childrenByParent holds the same object as
    // nodeById, and the unplaced child re-anchored to the dragged parent.
    const b2 = second.world!.nodeById.get('b')!
    const c2 = second.world!.nodeById.get('c')!
    expect(second.world!.childrenByParent.get('b')![0]).toBe(c2)
    expect(c2.position).toEqual([
      b2.position[0] + c2.state.relOffset![0],
      b2.position[1] + c2.state.relOffset![1],
    ])
  })

  it('move reports a missing node as missing, not locked', () => {
    const world = boot()
    expect(applyCommand(world, { type: 'move', id: 'ghost', to: [1, 1] }, testAdapter)).toMatchObject({
      ok: false,
      error: 'missing',
    })
  })
})

describe('drag-frame semantics (via the move command)', () => {
  it('moves the placed node and its movable subtree, nothing else', () => {
    const world = boot()
    const placed = applyCommand(world, { type: 'move', id: 'b', to: [400, 400] }, testAdapter).world!
    const b = placed.nodeById.get('b')!
    const c = placed.nodeById.get('c')!
    const delta: [number, number] = [10, -5]
    const moved = applyCommand(placed, { type: 'move', id: 'b', to: [b.position[0] + 10, b.position[1] - 5] }, testAdapter).world!
    expect(moved.nodeById.get('b')!.position).toEqual([b.position[0] + 10, b.position[1] - 5])
    expect(moved.nodeById.get('c')!.position).toEqual([c.position[0] + 10, c.position[1] - 5])
    expect(moved.nodeById.get('a')!.position).toEqual(world.nodeById.get('a')!.position)
    expect(delta).toEqual([10, -5]) // self-check of the arithmetic above
    // Both indexes agree: childrenByParent holds the SAME node objects.
    expect(moved.childrenByParent.get('b')![0]).toBe(moved.nodeById.get('c'))
  })

  it('no-ops on a zero delta and refuses the unplaced/unknown gracefully', () => {
    const world = boot()
    expect(applyCommand(world, { type: 'move', id: 'ghost', to: [1, 1] }, testAdapter).ok).toBe(false)
    const placed = applyCommand(world, { type: 'move', id: 'b', to: [400, 400] }, testAdapter).world!
    const pos = placed.nodeById.get('b')!.position
    const res = applyCommand(placed, { type: 'move', id: 'b', to: [pos[0], pos[1]] }, testAdapter)
    expect(res.ok).toBe(true)
    expect(res.world).toBeUndefined() // silent no-op
  })

  it('makeNode is part of the fixture contract', () => {
    expect(makeNode({ id: 'x' }).groupPath).toEqual(['ML', 'Optimizers'])
  })
})
