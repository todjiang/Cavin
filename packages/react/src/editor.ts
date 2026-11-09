/**
 * The drag editor: frame-coalesced moves. Pointermove can exceed 60Hz, but a
 * drag's position update only needs to land once per frame — buffered here
 * and flushed as a single `move` command per frame, so every world mutation
 * still travels through applyCommand. Pure module: the frame scheduler is
 * injected, so tests need no DOM.
 */

export interface EditorScheduler {
  requestAnimationFrame: (fn: () => void) => number
  cancelAnimationFrame: (id: number) => void
}

/** Production scheduler — the only place rAF is referenced. */
export const rafScheduler: EditorScheduler = {
  requestAnimationFrame: (fn) => window.requestAnimationFrame(fn),
  cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
}

export interface EditorOptions {
  /** The command funnel — in production the world store's dispatch. */
  dispatch: (cmd: { type: 'move'; id: string; to: [number, number] }) => void
  /** Inject a fake scheduler in tests; defaults to requestAnimationFrame. */
  scheduler?: EditorScheduler
}

export interface Editor {
  /** Buffer the latest drag position; flushed as ONE move command per frame. */
  bufferMove: (id: string, pos: [number, number]) => void
  /** Flush any buffered move immediately (unmount / tests). */
  flush: () => void
  /** Drop the buffered move and cancel the pending frame. */
  cancel: () => void
}

export function createEditor(options: EditorOptions): Editor {
  const scheduler = options.scheduler ?? rafScheduler
  let pending: { id: string; pos: [number, number] } | null = null
  let raf = 0

  const flush = () => {
    raf = 0
    if (!pending) return
    const move = pending
    pending = null
    options.dispatch({ type: 'move', id: move.id, to: move.pos })
  }

  return {
    bufferMove(id, pos) {
      pending = { id, pos }
      if (!raf) raf = scheduler.requestAnimationFrame(flush)
    },
    flush() {
      if (raf) scheduler.cancelAnimationFrame(raf)
      flush()
    },
    cancel() {
      if (raf) scheduler.cancelAnimationFrame(raf)
      raf = 0
      pending = null
    },
  }
}
