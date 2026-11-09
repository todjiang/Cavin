import { describe, expect, it } from 'vitest'
import { createMemoryCavinStorage, validateRecords } from './storage'
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

describe('validateEdgeRecords', () => {
  it('keeps only structurally valid edges, never throws', () => {
    expect(validateEdgeRecords(null)).toEqual([])
    expect(validateEdgeRecords([{ id: 'e', from: 'a', to: 'b' }, { id: 1 }, null])).toEqual([
      { id: 'e', from: 'a', to: 'b' },
    ])
  })
})
