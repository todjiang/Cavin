import { describe, expect, it, vi } from 'vitest'
import { createEditor, type EditorScheduler } from './editor'

/**
 * The drag editor coalesces pointermove positions into ONE move command per
 * frame. Pure module: the frame scheduler is injected, so the tests run a
 * fake rAF queue — no DOM, no window.
 */

function fakeRaf() {
  const queue = new Map<number, () => void>()
  let seq = 0
  const scheduler: EditorScheduler = {
    requestAnimationFrame: (fn) => {
      const id = ++seq
      queue.set(id, fn)
      return id
    },
    cancelAnimationFrame: (id) => {
      queue.delete(id)
    },
  }
  const runFrame = () => {
    const pending = [...queue.entries()]
    queue.clear()
    for (const [, fn] of pending) fn()
  }
  return { scheduler, runFrame, pendingCount: () => queue.size }
}

describe('createEditor', () => {
  it('flushes the buffered position as a single move command per frame', () => {
    const { scheduler, runFrame } = fakeRaf()
    const dispatch = vi.fn()
    const editor = createEditor({ dispatch, scheduler })

    editor.bufferMove('n1', [1, 1])
    editor.bufferMove('n1', [2, 2])
    editor.bufferMove('n1', [3, 3])
    expect(dispatch).not.toHaveBeenCalled()
    runFrame()
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'move', id: 'n1', to: [3, 3] })
  })

  it('schedules a fresh frame after each flush', () => {
    const { scheduler, runFrame } = fakeRaf()
    const dispatch = vi.fn()
    const editor = createEditor({ dispatch, scheduler })

    editor.bufferMove('n1', [1, 1])
    runFrame()
    editor.bufferMove('n1', [2, 2])
    runFrame()
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'move', id: 'n1', to: [2, 2] })
  })

  it('cancel drops the buffered move and the pending frame', () => {
    const { scheduler, runFrame } = fakeRaf()
    const dispatch = vi.fn()
    const editor = createEditor({ dispatch, scheduler })

    editor.bufferMove('n1', [1, 1])
    editor.cancel()
    runFrame()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('flush is idempotent with an empty buffer', () => {
    const { scheduler } = fakeRaf()
    const dispatch = vi.fn()
    const editor = createEditor({ dispatch, scheduler })
    editor.flush()
    editor.flush()
    expect(dispatch).not.toHaveBeenCalled()
  })
})
