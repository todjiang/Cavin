import { describe, expect, it } from 'vitest'
import type { CavinNode } from './types'
import { deriveWorld, groupPathKey, reparentNodes } from './layout'
import { makeNode, testAdapter } from './test-helpers'

/**
 * The generic grouping contract: world.groups is aggregated from groupPath
 * at ARBITRARY depth — zero levels (flat task list), two levels (the demo),
 * three levels (deeper taxonomies). This is the headless litmus test for
 * "the core no longer knows what a wing or a room is".
 */

/** Two top groups × two sub groups of roots, matching the demo's two-level shape. */
function twoLevel(): CavinNode<{ title: string; embedding: number[] }>[] {
  const out: CavinNode<{ title: string; embedding: number[] }>[] = []
  for (const [top, x] of [
    ['ML', 0],
    ['Design', 1000],
  ] as const) {
    for (const [sub, dy] of [
      ['A', 0],
      ['B', 400],
    ] as const) {
      for (let i = 0; i < 3; i++) {
        out.push(
          makeNode({
            id: `${top}-${sub}-${i}`,
            groupPath: [top, `${top}-${sub}`],
            position: [x + i * 10, dy + i * 10],
          }),
        )
      }
    }
  }
  return out
}

describe('world.groups (generic clusters over groupPath)', () => {
  it('aggregates the two-level demo shape with stable hues', () => {
    const world = deriveWorld(twoLevel(), testAdapter)
    const top = world.groups.filter((g) => g.depth === 0)
    const sub = world.groups.filter((g) => g.depth === 1)
    expect(top).toHaveLength(2)
    expect(sub).toHaveLength(4)

    // First-encounter hue rotation: ML = 15°, Design = 75° (the wing scheme).
    expect(top.map((g) => [g.name, g.count])).toEqual([
      ['ML', 6],
      ['Design', 6],
    ])
    expect(top[0].hue).toBe(15)
    expect(top[1].hue).toBe(75)
    // Sub clusters inherit their top-level hue.
    expect(sub.every((g) => (g.path[0] === 'ML' ? g.hue === 15 : g.hue === 75))).toBe(true)
    // Sub-cluster centroid = its grid-bound roots.
    const mlA = world.groupByPath.get(groupPathKey(['ML', 'ML-A']))!
    expect(mlA.centroid).toEqual([10, 10])
    expect(mlA.count).toBe(3)
  })

  it('aggregates three-level paths: leaf clusters from roots, interior from sub-clusters', () => {
    const nodes = [
      makeNode({ id: 'r1', groupPath: ['Work', 'Backend', 'DB'], position: [100, 0] }),
      makeNode({ id: 'r2', groupPath: ['Work', 'Backend', 'DB'], position: [300, 0] }),
      makeNode({ id: 'r3', groupPath: ['Work', 'Frontend', 'UI'], position: [100, 500] }),
      // Children count but never warp cluster geometry.
      makeNode({
        id: 'c1',
        parentId: 'r1',
        groupPath: ['Work', 'Backend', 'DB'],
        position: [9999, 9999],
      }),
    ]
    const world = deriveWorld(nodes, testAdapter)
    const byPath = (p: string[]) => world.groupByPath.get(groupPathKey(p))!

    const db = byPath(['Work', 'Backend', 'DB'])
    expect(db.depth).toBe(2)
    expect(db.count).toBe(3) // r1 + r2 + child c1
    expect(db.centroid).toEqual([200, 0]) // roots only

    const backend = byPath(['Work', 'Backend'])
    expect(backend.depth).toBe(1)
    expect(backend.centroid).toEqual(db.centroid) // one sub-cluster
    expect(backend.count).toBe(3)

    const work = byPath(['Work'])
    expect(work.depth).toBe(0)
    expect(work.count).toBe(4)
    // Mean of the two depth-1 sub-cluster centroids.
    expect(work.centroid[0]).toBeCloseTo((200 + 100) / 2)
    expect(work.centroid[1]).toBeCloseTo((0 + 500) / 2)
    // Radius covers both sub-clusters.
    const d = Math.hypot(200 - 150, 0 - 250)
    expect(work.radius).toBeCloseTo(d + db.radius)
  })

  it('supports a flat list with a single grouping level', () => {
    const nodes = [
      makeNode({ id: 't1', groupPath: ['Tasks'], position: [10, 0] }),
      makeNode({ id: 't2', groupPath: ['Tasks'], position: [30, 0] }),
    ]
    const world = deriveWorld(nodes, testAdapter)
    const tasks = world.groups.filter((g) => g.depth === 0)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].path).toEqual(['Tasks'])
    expect(tasks[0].count).toBe(2)
    expect(tasks[0].centroid).toEqual([20, 0])
    expect(world.groups.every((g) => g.depth === 0)).toBe(true)
  })

  it('leaves ungrouped nodes (empty path) out of every cluster', () => {
    const nodes = [
      makeNode({ id: 'free', groupPath: [], position: [5, 5] }),
      makeNode({ id: 'grouped', groupPath: ['Inbox'], position: [100, 100] }),
    ]
    const world = deriveWorld(nodes, testAdapter)
    expect(world.groups.map((g) => g.path)).toEqual([['Inbox']])
    expect(world.groups[0].count).toBe(1)
  })

  it('keeps a cluster stable when all its roots go free-placed (prev centroid)', () => {
    const nodes = [
      makeNode({ id: 'a', groupPath: ['W', 'R'], position: [100, 100] }),
      makeNode({ id: 'b', groupPath: ['W', 'R'], position: [200, 200] }),
    ]
    const w1 = deriveWorld(nodes, testAdapter)
    const before = w1.groupByPath.get(groupPathKey(['W', 'R']))!
    expect(before.centroid).toEqual([150, 150])

    const dragged = w1.nodes.map((n) => ({
      ...n,
      state: { ...n.state, placed: true },
      position: [999, 999] as [number, number],
    }))
    const w2 = deriveWorld(dragged, testAdapter, w1)
    const after = w2.groupByPath.get(groupPathKey(['W', 'R']))!
    expect(after.centroid).toEqual([150, 150])
  })

  it('re-parenting moves the subtree’s groupPath to the new parent', () => {
    const nodes = [
      makeNode({ id: 'p', groupPath: ['Design', 'Type'] }),
      makeNode({ id: 'n', groupPath: ['ML', 'Opt'] }),
      makeNode({
        id: 'kid',
        parentId: 'n',
        groupPath: ['ML', 'Opt'],
        state: { relOffset: [5, 5] },
        position: [5, 5],
      }),
    ]
    const res = reparentNodes(nodes, 'n', 'p', () => 0.5)
    expect(res.ok).toBe(true)
    const moved = res.nodes!.find((n) => n.id === 'n')!
    const kid = res.nodes!.find((n) => n.id === 'kid')!
    expect(moved.groupPath).toEqual(['Design', 'Type'])
    expect(kid.groupPath).toEqual(['Design', 'Type'])
    // And the derived groups reflect the move.
    const world = deriveWorld(res.nodes!, testAdapter)
    expect(world.groupByPath.get(groupPathKey(['Design', 'Type']))!.count).toBe(3)
    expect(world.groupByPath.has(groupPathKey(['ML', 'Opt']))).toBe(false)
  })
})
