import { describe, expect, it } from 'vitest'
import type { LaidOutNode } from './layout'
import { deriveWorld, groupPathKey, reparentNodes } from './layout'

/**
 * The generic grouping contract: world.groups is aggregated from groupPath
 * at ARBITRARY depth — zero levels (flat task list), two levels (the demo),
 * three levels (deeper taxonomies) — while staying identical to the legacy
 * wings/rooms aggregates on two-level data. This is the headless litmus
 * test for "the core no longer knows what a wing or a room is".
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

/** Two wings × two rooms of roots, matching the demo's two-level shape. */
function twoLevel(): LaidOutNode[] {
  const out: LaidOutNode[] = []
  for (const [w, wingName, x] of [
    ['wing-0', 'ML', 0],
    ['wing-1', 'Design', 1000],
  ] as const) {
    for (const [r, roomName, dy] of [
      [0, `${wingName}-A`, 0],
      [1, `${wingName}-B`, 400],
    ] as const) {
      for (let i = 0; i < 3; i++) {
        out.push(
          makeNode({
            id: `${w}-${r}-${i}`,
            wingId: w,
            wingName,
            roomId: `${w}-room-${r}`,
            roomName,
            position: [x + i * 10, dy + i * 10],
          }),
        )
      }
    }
  }
  return out
}

describe('world.groups (generic clusters over groupPath)', () => {
  it('matches the legacy wings/rooms aggregates on two-level data', () => {
    const world = deriveWorld(twoLevel())
    const top = world.groups.filter((g) => g.depth === 0)
    const sub = world.groups.filter((g) => g.depth === 1)
    expect(top).toHaveLength(2)
    expect(sub).toHaveLength(4)

    for (const wing of world.wings) {
      const g = world.groups.find((c) => c.depth === 0 && c.name === wing.name)!
      expect(g.centroid).toEqual(wing.centroid)
      expect(g.radius).toBeCloseTo(wing.radius)
      expect(g.count).toBe(wing.count)
      expect(g.hue).toBe(wing.hue)
      expect(g.color).toBe(wing.color)
    }
    for (const room of world.rooms) {
      const g = world.groupByPath.get(groupPathKey([room.wingName, room.name]))!
      expect(g).toBeDefined()
      expect(g.centroid).toEqual(room.centroid)
      expect(g.radius).toBeCloseTo(room.radius)
      expect(g.count).toBe(room.count)
      expect(g.hue).toBe(room.hue)
    }
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
    const world = deriveWorld(nodes)
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
    const world = deriveWorld(nodes)
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
    const world = deriveWorld(nodes)
    expect(world.groups.map((g) => g.path)).toEqual([['Inbox']])
    expect(world.groups[0].count).toBe(1)
  })

  it('keeps a cluster stable when all its roots go free-placed (prev centroid)', () => {
    const nodes = [
      makeNode({ id: 'a', groupPath: ['W', 'R'], position: [100, 100] }),
      makeNode({ id: 'b', groupPath: ['W', 'R'], position: [200, 200] }),
    ]
    const w1 = deriveWorld(nodes)
    const before = w1.groupByPath.get(groupPathKey(['W', 'R']))!
    expect(before.centroid).toEqual([150, 150])

    const dragged = w1.nodes.map((n) => ({
      ...n,
      placed: true,
      position: [999, 999] as [number, number],
    }))
    const w2 = deriveWorld(dragged, w1)
    const after = w2.groupByPath.get(groupPathKey(['W', 'R']))!
    expect(after.centroid).toEqual([150, 150])
  })

  it('re-parenting moves the subtree’s groupPath to the new parent', () => {
    const nodes = [
      makeNode({
        id: 'p',
        groupPath: ['Design', 'Type'],
        wingId: 'wing-1',
        wingName: 'Design',
        roomId: 'wing-1-room-0',
        roomName: 'Type',
      }),
      makeNode({ id: 'n', groupPath: ['ML', 'Opt'] }),
      makeNode({
        id: 'kid',
        parentId: 'n',
        groupPath: ['ML', 'Opt'],
        relOffset: [5, 5],
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
    const world = deriveWorld(res.nodes!)
    expect(world.groupByPath.get(groupPathKey(['Design', 'Type']))!.count).toBe(3)
    expect(world.groupByPath.has(groupPathKey(['ML', 'Opt']))).toBe(false)
  })
})
