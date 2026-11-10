import { describe, expect, it } from 'vitest'
import { createMemoryCavinStorage, decodeSnapshot, validateRecords } from './storage'
import { validateEdgeRecords } from './edges'
import { testAdapter } from './test-helpers'

/**
 * The persistence contract: one snapshot behind one interface, and ABSENT
 * distinct from EMPTY — an emptied world must round-trip as empty, not as
 * "never saved".
 */

describe('createMemoryCavinStorage', () => {
  it('returns null before the first save (absent)', () => {
    const storage = createMemoryCavinStorage()
    expect(storage.load()).toBeNull()
  })

  it('round-trips a snapshot', () => {
    const storage = createMemoryCavinStorage()
    const nodes = [
      {
        id: 'n1',
        position: [0, 0] as [number, number],
        groupPath: ['A'],
        attributes: { title: 'x', embedding: [] },
        state: {},
      },
    ]
    const confirmedEdges = [{ id: 'e1', from: 'n1', to: 'n1-x', createdAt: 1 }]
    expect(storage.save({ nodes, confirmedEdges })).toBe(true)
    expect(storage.load()).toEqual({ nodes, confirmedEdges })
  })

  it('an emptied world reloads as empty, not as absent', () => {
    const storage = createMemoryCavinStorage()
    storage.save({ nodes: [], confirmedEdges: [] })
    expect(storage.load()).toEqual({ nodes: [], confirmedEdges: [] })
    storage.clear()
    expect(storage.load()).toBeNull()
  })

  it('notifies subscribers on clear', () => {
    const storage = createMemoryCavinStorage()
    const seen: unknown[] = []
    storage.subscribe?.((s) => seen.push(s))
    storage.save({ nodes: [], confirmedEdges: [] })
    storage.clear()
    expect(seen).toEqual([null])
  })
})

describe('validateRecords', () => {
  it('returns null for non-array input, empty array for all-dropped records', () => {
    expect(validateRecords(null, testAdapter)).toBeNull()
    expect(validateRecords('nope', testAdapter)).toBeNull()
    const allBad = validateRecords([null, 42, {}], testAdapter)
    expect(allBad).toEqual({ nodes: [], dropped: 3 })
  })

  it('decodes valid records and counts drops without throwing', () => {
    const decodingAdapter = {
      ...testAdapter,
      validate: (raw: unknown) => {
        const r = raw as { id?: unknown; position?: unknown }
        if (typeof r?.id === 'string' && Array.isArray(r.position)) {
          return {
            id: r.id,
            position: [0, 0] as [number, number],
            groupPath: [],
            attributes: { title: '', embedding: [] },
            state: {},
          }
        }
        return null
      },
    }
    const result = validateRecords([{ id: 'g', position: [0, 0] }, { id: 'bad' }], decodingAdapter)
    expect(result!.nodes).toHaveLength(1)
    expect(result!.dropped).toBe(1)
  })
})

describe('decodeSnapshot', () => {
  /** testAdapter.validate always returns null — use a decoding adapter. */
  const decodingAdapter = {
    ...testAdapter,
    validate: (raw: unknown) => {
      const r = raw as { id?: unknown; position?: unknown }
      if (typeof r?.id === 'string' && Array.isArray(r.position)) {
        return {
          id: r.id,
          position: [0, 0] as [number, number],
          groupPath: [],
          attributes: { title: '', embedding: [] },
          state: {},
        }
      }
      return null
    },
  }
  const node = (id: string) => ({ id, position: [0, 0] })

  it('accepts the snapshot shape, a bare node array, and { nodes }', () => {
    const full = decodeSnapshot(
      { nodes: [node('a')], confirmedEdges: [{ id: 'e', from: 'a', to: 'b', createdAt: 0 }] },
      decodingAdapter,
    )
    expect(full!.snapshot.nodes).toHaveLength(1)
    expect(full!.snapshot.confirmedEdges).toHaveLength(1)
    expect(full!.droppedNodes).toBe(0)

    const bare = decodeSnapshot([node('a')], decodingAdapter)
    expect(bare!.snapshot.nodes).toHaveLength(1)
    expect(bare!.snapshot.confirmedEdges).toEqual([])

    const nodesOnly = decodeSnapshot({ nodes: [node('a')] }, decodingAdapter)
    expect(nodesOnly!.snapshot.nodes).toHaveLength(1)
  })

  it('maps the legacy { nodes, edges } alias onto confirmedEdges', () => {
    const decoded = decodeSnapshot(
      { nodes: [node('a')], edges: [{ id: 'e', from: 'a', to: 'b', createdAt: 0 }] },
      decodingAdapter,
    )
    expect(decoded!.snapshot.confirmedEdges).toEqual([{ id: 'e', from: 'a', to: 'b', createdAt: 0 }])
  })

  it('treats { nodes: [] } as a valid empty snapshot, never null', () => {
    const decoded = decodeSnapshot({ nodes: [], confirmedEdges: [] }, decodingAdapter)
    expect(decoded!.snapshot).toEqual({ nodes: [], confirmedEdges: [] })
    expect(decoded!.droppedNodes).toBe(0)
  })

  it('returns null for malformed payloads and reports partial drops', () => {
    expect(decodeSnapshot(null, decodingAdapter)).toBeNull()
    expect(decodeSnapshot('nope', decodingAdapter)).toBeNull()
    expect(decodeSnapshot(42, decodingAdapter)).toBeNull()
    expect(decodeSnapshot({ noNodes: true }, decodingAdapter)).toBeNull()
    expect(decodeSnapshot({ nodes: 'nope' }, decodingAdapter)).toBeNull()

    const partial = decodeSnapshot({ nodes: [node('a'), null, 42] }, decodingAdapter)
    expect(partial!.snapshot.nodes).toHaveLength(1)
    expect(partial!.droppedNodes).toBe(2)
  })
})

describe('validateEdgeRecords', () => {
  it('keeps only structurally valid edges, never throws', () => {
    expect(validateEdgeRecords(null)).toEqual([])
    expect(validateEdgeRecords([{ id: 'e', from: 'a', to: 'b' }, { id: 1 }, null])).toEqual([
      { id: 'e', from: 'a', to: 'b' },
    ])
  })
})
