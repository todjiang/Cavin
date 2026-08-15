import { create } from 'zustand'
import { layoutConfig } from './config'

const { camera: CAM, lod: LOD } = layoutConfig

export interface Camera {
  /** World coords at the viewport center. */
  x: number
  y: number
  /** Scale: screen px per world unit. */
  zoom: number
}

export const MIN_ZOOM = CAM.minZoom
// Deep enough to pass THROUGH the deepest rooms: revealZoom saturates at
// depth 6 (≈3.4 at default zCards), and full pass-through needs ×2.6 more.
export const MAX_ZOOM = CAM.maxZoom

/** Dev/preview affordance: ?x=&y=&zoom= jumps straight to a viewpoint. */
function initialCam(): Camera {
  const p = new URLSearchParams(window.location.search)
  const zoom = Number(p.get('zoom'))
  if (p.has('zoom') && Number.isFinite(zoom) && zoom > 0) {
    const x = Number(p.get('x'))
    const y = Number(p.get('y'))
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
    }
  }
  return { x: 0, y: 0, zoom: 0.1 }
}

/** Persisted view tuning (LOD thresholds + time slider). */
const VIEW_KEY = 'cavin-view-v1'

function loadViewSettings(): { zRooms: number; zCards: number; timeT: number } {
  const defaults = { zRooms: LOD.zRooms, zCards: LOD.zCards, timeT: 0 }
  try {
    const raw = window.localStorage.getItem(VIEW_KEY)
    if (!raw) return defaults
    const v = JSON.parse(raw)
    return {
      zRooms: typeof v.zRooms === 'number' ? v.zRooms : defaults.zRooms,
      zCards: typeof v.zCards === 'number' ? v.zCards : defaults.zCards,
      timeT: typeof v.timeT === 'number' ? v.timeT : defaults.timeT,
    }
  } catch {
    return defaults
  }
}

export interface ViewState {
  cam: Camera
  /** Zoom at which room labels appear. */
  zRooms: number
  /** Zoom at which full cards appear. */
  zCards: number
  /** Time-dimension slider 0..1 (0 = all eras bright, 1 = only the newest). */
  timeT: number
  selectedId: string | null
  breadcrumb: string

  setCam: (c: Camera) => void
  setZRooms: (v: number) => void
  setZCards: (v: number) => void
  setTimeT: (v: number) => void
  select: (id: string | null) => void
  setBreadcrumb: (b: string) => void
}

const viewDefaults = loadViewSettings()

export const useViewStore = create<ViewState>()((set) => ({
  cam: initialCam(),
  zRooms: viewDefaults.zRooms,
  zCards: viewDefaults.zCards,
  timeT: viewDefaults.timeT,
  selectedId: null,
  breadcrumb: '',

  setCam: (cam) => set({ cam }),
  setZRooms: (v) => set((s) => ({ zRooms: v, zCards: Math.max(s.zCards, v + 0.1) })),
  setZCards: (v) => set((s) => ({ zCards: Math.max(v, s.zRooms + 0.1) })),
  setTimeT: (v) => set({ timeT: v }),
  select: (id) => set({ selectedId: id }),
  setBreadcrumb: (b) => set({ breadcrumb: b }),
}))

// Persist view tuning (debounced) so LOD sliders survive reloads.
let viewSaveTimer: number | undefined
useViewStore.subscribe((s, prev) => {
  if (s.zRooms === prev.zRooms && s.zCards === prev.zCards && s.timeT === prev.timeT) return
  window.clearTimeout(viewSaveTimer)
  viewSaveTimer = window.setTimeout(() => {
    const { zRooms, zCards, timeT } = useViewStore.getState()
    try {
      window.localStorage.setItem(VIEW_KEY, JSON.stringify({ zRooms, zCards, timeT }))
    } catch {
      // non-fatal — tuning just won't persist
    }
  }, 300)
})

// URL sync: mirror the camera into ?x=&y=&zoom= (debounced, replaceState) and
// respond to back/forward so the view is shareable and history-aware.
let urlTimer: number | undefined
let lastUrl = ''
function pushUrl(cam: Camera) {
  const p = new URLSearchParams(window.location.search)
  p.set('x', String(Math.round(cam.x)))
  p.set('y', String(Math.round(cam.y)))
  p.set('zoom', cam.zoom.toFixed(3))
  const url = `${window.location.pathname}?${p.toString()}`
  if (url === lastUrl) return
  lastUrl = url
  window.history.replaceState(null, '', url)
}
useViewStore.subscribe((s, prev) => {
  if (s.cam === prev.cam) return
  window.clearTimeout(urlTimer)
  urlTimer = window.setTimeout(() => pushUrl(useViewStore.getState().cam), 400)
})
window.addEventListener('popstate', () => {
  const p = new URLSearchParams(window.location.search)
  const zoom = Number(p.get('zoom'))
  if (!p.has('zoom') || !Number.isFinite(zoom) || zoom <= 0) return
  const x = Number(p.get('x'))
  const y = Number(p.get('y'))
  useViewStore.getState().setCam({
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
  })
})
