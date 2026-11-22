import { describe, expect, it, vi } from 'vitest'
import type { CavinEdge, CavinNode, World, WorldSnapshot } from '@cavin/core'
import { createMemoryCavinStorage, layoutConfig, suggestEdges } from '@cavin/core'
import { createSession, type Scheduler } from './session'
import { createSuggestionCache } from './suggestions'

/**
 * The session owns boot / reset / persistence with the scheduler injected —
 * every test here runs on a fake timer queue and an in-memory storage, so
 * no window, no DOM, no real waiting.
 */

interface Attrs {
  title: string
  embedding: number[]
}

const adapter = {
  noun: 'item',
  labelOf: (n: CavinNode<Attrs>) => n.attributes.title,
  fields: [{ key: 'title' as const, label: 'Title', kind: 'text' as const }],
  validate: () => null,
  createDefault: (): Attrs => ({ title: '', embedding: [1, 0] }),
  layoutVectorOf: (n: CavinNode<Attrs>) => n.attributes.embedding,
}

const node = (id: string, top: string, embedding: number[]): CavinNode<Attrs> => ({
  id,
  position: [0, 0],
  groupPath: [top],
  attributes: { title: id, embedding },
  state: {},
})

const DRAFT = [node('a', 'X', [1, 0])]

function fakeTimers() {
  const queue = new Map<unknown, () => void>()
  let seq = 0
  const scheduler: Scheduler = {
    setTimeout: (fn) => {
      const id = ++seq
      queue.set(id, fn)
      return id
    },
    clearTimeout: (id) => {
      queue.delete(id)
    },
  }
  return { scheduler, runPending: () => [...queue.values()].forEach((fn) => fn()) }
}

const makeSession = (opts: {
  storage?: ReturnType<typeof createMemoryCavinStorage<Attrs>>
  initialNodes?: CavinNode<Attrs>[]
  scheduler?: Scheduler
}) =>
  createSession<Attrs>({
    adapter,
    config: layoutConfig,
    storage: opts.storage ?? createMemoryCavinStorage<Attrs>(),
    suggestions: createSuggestionCache<Attrs>(adapter),
    initialNodes: opts.initialNodes,
    scheduler: opts.scheduler,
  })

describe('createSession', () => {
  it('boots from the initial draft when storage is empty', () => {
    const session = makeSession({ initialNodes: DRAFT })
    expect(session.boot().nodes.map((n) => n.id)).toEqual(['a'])
  })

  it('storage wins over the draft on boot; reset wipes and returns to the draft', () => {
    const storage = createMemoryCavinStorage<Attrs>()
    const stored: WorldSnapshot<Attrs> = {
      nodes: [node('stored', 'Y', [0, 1])],
      confirmedEdges: [],
    }
    vi.spyOn(storage, 'load').mockReturnValue(stored)
    const session = makeSession({ storage, initialNodes: DRAFT })
    expect(session.boot().nodes.map((n) => n.id)).toEqual(['stored'])

    const cleared = vi.spyOn(storage, 'clear').mockImplementation(() => {})
    const reset = session.reset()
    expect(cleared).toHaveBeenCalled()
    expect(reset.nodes.map((n) => n.id)).toEqual(['a'])
  })

  it('corrupt storage falls through to the draft', () => {
    const storage = createMemoryCavinStorage<Attrs>()
    vi.spyOn(storage, 'load').mockImplementation(() => {
      throw new Error('corrupt')
    })
    const session = makeSession({ storage, initialNodes: DRAFT })
    expect(session.boot().nodes.map((n) => n.id)).toEqual(['a'])
  })

  it('debounces saves: many world changes land as one snapshot write', () => {
    const storage = createMemoryCavinStorage<Attrs>()
    const save = vi.spyOn(storage, 'save').mockReturnValue(true)
    const { scheduler, runPending } = fakeTimers()
    const session = makeSession({ storage, initialNodes: DRAFT, scheduler })

    const world = session.boot()
    const changed: World<Attrs> = {
      ...world,
      nodes: [...world.nodes, node('b', 'X', [1, 0])],
    }
    let subscribed: (s: { world: World<Attrs> }, prev: { world: World<Attrs> }) => void = () => {}
    const watchFn = {
      subscribe: (fn: (s: { world: World<Attrs> }, prev: { world: World<Attrs> }) => void) => {
        subscribed = fn
        return () => {}
      },
    }
    const toast = vi.fn()
    const dispose = session.persistOnChange(watchFn, toast)

    subscribed({ world: changed }, { world })
    subscribed({ world: changed }, { world: changed }) // no change → ignored
    expect(save).not.toHaveBeenCalled()
    runPending()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ nodes: changed.nodes, confirmedEdges: [] })
    expect(toast).not.toHaveBeenCalled()
    dispose() // returns a disposer; calling it must not throw
  })

  it('toasts once when a save fails, and recovers after a success', () => {
    const storage = createMemoryCavinStorage<Attrs>()
    const save = vi.spyOn(storage, 'save').mockReturnValue(false)
    const { scheduler, runPending } = fakeTimers()
    const session = makeSession({ storage, initialNodes: DRAFT, scheduler })

    let subscribed: (s: { world: World<Attrs> }, prev: { world: World<Attrs> }) => void = () => {}
    const toast = vi.fn()
    session.persistOnChange({ subscribe: (fn) => ((subscribed = fn), () => {}) }, toast)

    const world = session.boot()
    const changed: World<Attrs> = { ...world, nodes: [...world.nodes] }
    subscribed({ world: changed }, { world })
    runPending()
    subscribed({ world: changed }, { world: { ...changed } })
    runPending()
    expect(save).toHaveBeenCalledTimes(2)
    expect(toast).toHaveBeenCalledTimes(1) // warned once, latched
    save.mockReturnValue(true)
    subscribed({ world: changed }, { world: { ...changed } })
    runPending()
    expect(toast).toHaveBeenCalledTimes(1) // success resets the latch silently
  })

  it('withFreshSuggestions re-derives only when suggestion inputs change', () => {
    const session = makeSession({ initialNodes: DRAFT })
    const world = session.boot()
    expect(world.edges.filter((e) => e.kind === 'suggested')).toHaveLength(0)

    // Add a node with a matching vector — suggestion inputs change.
    const more: CavinNode<Attrs>[] = [...DRAFT, node('b', 'Y', [1, 0])]
    const suggested: CavinEdge[] = suggestEdges(more, (n) => n.groupPath[0] ?? '', (n) => n.attributes.embedding)
    expect(suggested.length).toBeGreaterThan(0)

    const staleWorld: World<Attrs> = {
      ...world,
      nodes: more,
      edges: world.edges.filter((e) => e.kind === 'confirmed'),
    }
    const fresh = session.withFreshSuggestions(staleWorld)
    expect(fresh.edges.filter((e) => e.kind === 'suggested').length).toBe(suggested.length)
    // Identity check: same suggestion array → no re-derive.
    expect(session.withFreshSuggestions(fresh)).toBe(fresh)
  })
})
