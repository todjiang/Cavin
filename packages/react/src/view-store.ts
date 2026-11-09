import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { Camera, LayoutConfig } from '@cavin/core'
import { layoutConfig } from '@cavin/core'

/**
 * The view store factory — camera, LOD thresholds, selection, URL sync.
 * One store per mounted canvas; `urlSync` and persisted tuning are opt-in
 * so embedded canvases don't fight over the page URL. The resolved
 * LayoutConfig seeds the zoom bounds and the HUD slider defaults, so a
 * host's `config` prop changes what this store starts from.
 */

export interface ViewStoreOptions {
  /** The resolved config for this canvas (defaults deep-merged with the
      host's overrides). Seeds minZoom/maxZoom and the LOD/font defaults. */
  config?: LayoutConfig
  /** localStorage key for persisted view tuning (LOD sliders, font). Omit →
      tuning is session-only. */
  storageKey?: string
  /** Mirror the camera into ?x=&y=&zoom= for shareable views. Off by
      default; the standalone demo app turns it on. */
  urlSync?: boolean
}

export interface ViewState {
  cam: Camera
  /** Zoom bounds for this canvas (from the resolved config). */
  minZoom: number
  maxZoom: number
  /** Zoom at which room labels appear. */
  zRooms: number
  /** Zoom at which full cards appear. */
  zCards: number
  /** Time-dimension slider 0..1 (0 = all eras bright, 1 = only the newest). */
  timeT: number
  /** Base node-label font size (px); child/room chips offset from it by the
      deltas in the resolved config. Runtime knob over the config default. */
  labelFont: number
  selectedId: string | null
  breadcrumb: string

  setCam: (c: Camera) => void
  setZRooms: (v: number) => void
  setZCards: (v: number) => void
  setTimeT: (v: number) => void
  setLabelFont: (v: number) => void
  select: (id: string | null) => void
  setBreadcrumb: (b: string) => void
}

export type ViewStore = UseBoundStore<StoreApi<ViewState>>

interface Tuning {
  zRooms: number
  zCards: number
  timeT: number
  labelFont: number
}

export function createViewStore(options: ViewStoreOptions = {}): ViewStore {
  const config = options.config ?? layoutConfig
  const defaultTuning = (): Tuning => ({
    zRooms: config.lod.zRooms,
    zCards: config.lod.zCards,
    timeT: 0,
    labelFont: config.labels.fontSize,
  })

  function loadTuning(key: string | undefined): Tuning {
    if (!key || typeof window === 'undefined') return defaultTuning()
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return defaultTuning()
      const v = JSON.parse(raw)
      const d = defaultTuning()
      return {
        zRooms: typeof v.zRooms === 'number' ? v.zRooms : d.zRooms,
        zCards: typeof v.zCards === 'number' ? v.zCards : d.zCards,
        timeT: typeof v.timeT === 'number' ? v.timeT : d.timeT,
        labelFont: typeof v.labelFont === 'number' ? v.labelFont : d.labelFont,
      }
    } catch {
      return defaultTuning()
    }
  }

  /** Dev/preview affordance: ?x=&y=&zoom= jumps straight to a viewpoint. */
  function initialCam(): Camera {
    if (typeof window === 'undefined') return { x: 0, y: 0, zoom: 0.1 }
    const p = new URLSearchParams(window.location.search)
    const zoom = Number(p.get('zoom'))
    if (p.has('zoom') && Number.isFinite(zoom) && zoom > 0) {
      const x = Number(p.get('x'))
      const y = Number(p.get('y'))
      return {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        // Deep enough to pass THROUGH the deepest rooms: revealZoom
        // saturates at depth 6, and full pass-through needs × passFull more.
        zoom: Math.min(config.camera.maxZoom, Math.max(config.camera.minZoom, zoom)),
      }
    }
    return { x: 0, y: 0, zoom: 0.1 }
  }

  const tuning = loadTuning(options.storageKey)

  const store = create<ViewState>()((set) => ({
    cam: options.urlSync ? initialCam() : { x: 0, y: 0, zoom: 0.1 },
    minZoom: config.camera.minZoom,
    maxZoom: config.camera.maxZoom,
    zRooms: tuning.zRooms,
    zCards: tuning.zCards,
    timeT: tuning.timeT,
    labelFont: tuning.labelFont,
    selectedId: null,
    breadcrumb: '',

    setCam: (cam) => set({ cam }),
    setZRooms: (v) => set((s) => ({ zRooms: v, zCards: Math.max(s.zCards, v + 0.1) })),
    setZCards: (v) => set((s) => ({ zCards: Math.max(v, s.zRooms + 0.1) })),
    setTimeT: (v) => set({ timeT: v }),
    setLabelFont: (v) => set({ labelFont: v }),
    select: (id) => set({ selectedId: id }),
    setBreadcrumb: (b) => set({ breadcrumb: b }),
  }))

  if (options.storageKey) {
    // Persist view tuning (debounced) so LOD sliders survive reloads.
    let viewSaveTimer: number | undefined
    store.subscribe((s, prev) => {
      if (
        s.zRooms === prev.zRooms &&
        s.zCards === prev.zCards &&
        s.timeT === prev.timeT &&
        s.labelFont === prev.labelFont
      )
        return
      window.clearTimeout(viewSaveTimer)
      viewSaveTimer = window.setTimeout(() => {
        const { zRooms, zCards, timeT, labelFont } = store.getState()
        try {
          window.localStorage.setItem(
            options.storageKey!,
            JSON.stringify({ zRooms, zCards, timeT, labelFont }),
          )
        } catch {
          // non-fatal — tuning just won't persist
        }
      }, 300)
    })
  }

  if (options.urlSync) {
    // URL sync: mirror the camera into ?x=&y=&zoom= (debounced, replaceState)
    // and respond to back/forward so the view is shareable and history-aware.
    let urlTimer: number | undefined
    let lastUrl = ''
    const pushUrl = (cam: Camera) => {
      const p = new URLSearchParams(window.location.search)
      p.set('x', String(Math.round(cam.x)))
      p.set('y', String(Math.round(cam.y)))
      p.set('zoom', cam.zoom.toFixed(3))
      const url = `${window.location.pathname}?${p.toString()}`
      if (url === lastUrl) return
      lastUrl = url
      window.history.replaceState(null, '', url)
    }
    store.subscribe((s, prev) => {
      if (s.cam === prev.cam) return
      window.clearTimeout(urlTimer)
      urlTimer = window.setTimeout(() => pushUrl(store.getState().cam), 400)
    })
    window.addEventListener('popstate', () => {
      const p = new URLSearchParams(window.location.search)
      const zoom = Number(p.get('zoom'))
      if (!p.has('zoom') || !Number.isFinite(zoom) || zoom <= 0) return
      const x = Number(p.get('x'))
      const y = Number(p.get('y'))
      store.getState().setCam({
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        zoom: Math.min(config.camera.maxZoom, Math.max(config.camera.minZoom, zoom)),
      })
    })
  }

  return store
}
