import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useViewStore, MIN_ZOOM, MAX_ZOOM } from '../store'
import type { Camera } from '../store'
import { useWorldStore } from '../store/world'
import { revealZoom, visibleNodes } from './lod'
import type { RoomMorph } from './lod'
import { layoutConfig } from '../config'
import { DotsCanvas } from './DotsCanvas'
import { ClusterLabels } from './ClusterLabels'
import { NodeLabelLayer } from './NodeLabelLayer'

const { camera: CAM, interaction: INTERACT } = layoutConfig

/**
 * Miro-style infinite canvas: drag to pan, wheel to zoom-to-cursor.
 * Owns the DOM world transform (updated every frame from the store camera),
 * the focus animation on selection, ESC to release, and the breadcrumb.
 * Editing entry points: double-click empty space creates a note at the cursor,
 * N creates one at the viewport center, C adds a child to the selection,
 * L locks it, Delete removes it.
 */
export function Board() {
  const containerRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const anim = useRef<{ active: boolean; target: Camera; rate: number }>({
    active: false,
    target: { x: 0, y: 0, zoom: 1 },
    rate: CAM.focusRate,
  })
  const selectedId = useViewStore((s) => s.selectedId)

  // Frame loop: apply world transform, run focus animation, update breadcrumb.
  useEffect(() => {
    let raf = 0
    let lastBreadcrumb = ''
    let lastCrumbAt = 0
    let lastCam: Camera | null = null
    let lastCrumbCam: Camera | null = null
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const s = useViewStore.getState()

      if (anim.current.active) {
        const t = anim.current.target
        const r = anim.current.rate
        const c = s.cam
        const next = {
          x: c.x + (t.x - c.x) * r,
          y: c.y + (t.y - c.y) * r,
          zoom: c.zoom + (t.zoom - c.zoom) * r,
        }
        if (
          Math.abs(next.x - t.x) < 1 &&
          Math.abs(next.y - t.y) < 1 &&
          Math.abs(next.zoom - t.zoom) / t.zoom < 0.01
        ) {
          anim.current.active = false
          s.setCam(t)
        } else {
          s.setCam(next)
        }
      }

      // Write the world transform only when the camera actually moved.
      if (s.cam !== lastCam) {
        lastCam = s.cam
        const container = containerRef.current
        const world = worldRef.current
        if (container && world) {
          const { cam } = useViewStore.getState()
          world.style.transform = `translate(${container.clientWidth / 2}px, ${container.clientHeight / 2}px) scale(${cam.zoom}) translate(${-cam.x}px, ${-cam.y}px)`
        }
      }

      // Breadcrumb only needs recomputing when the camera moved.
      if (s.cam !== lastCrumbCam) {
        lastCrumbCam = s.cam
        if (now - lastCrumbAt > 200) {
          lastCrumbAt = now
          const { cam } = useViewStore.getState()
          const { rooms } = useWorldStore.getState().world
          let best: (typeof rooms)[number] | null = null
          let bestD = Infinity
          for (const r of rooms) {
            const d = Math.hypot(r.centroid[0] - cam.x, r.centroid[1] - cam.y)
            if (d < bestD) {
              bestD = d
              best = r
            }
          }
          const crumb = best ? `${best.wingName} / ${best.name}` : ''
          if (crumb !== lastBreadcrumb) {
            lastBreadcrumb = crumb
            useViewStore.getState().setBreadcrumb(crumb)
          }

          // Weak centering while passing through a room: if the deepest
          // entered room drifts far from the viewport center, ease the
          // camera target a little toward it so the walls close around
          // you instead of sliding off-screen. Deliberately gentle —
          // explicit pans always win (they reset the target directly).
          if (anim.current.active) {
            const { zCards } = useViewStore.getState()
            const world = useWorldStore.getState().world
            const vis = visibleNodes(world, cam, window.innerWidth, window.innerHeight, zCards, 40)
            let deep: { m: RoomMorph; d: number } | null = null
            for (const v of vis) {
              if (v.morph.pass <= 0.5) continue
              const d = world.depthById.get(v.node.id) ?? 0
              if (!deep || d > deep.d) deep = { m: v.morph, d }
            }
            if (deep) {
              const t = anim.current.target
              const offX = (deep.m.pos[0] - t.x) * t.zoom
              const offY = (deep.m.pos[1] - t.y) * t.zoom
              if (offX * offX + offY * offY > INTERACT.recenterDistance ** 2) {
                t.x += (deep.m.pos[0] - t.x) * INTERACT.recenterRate
                t.y += (deep.m.pos[1] - t.y) * INTERACT.recenterRate
              }
            }
          }
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Wheel = zoom to cursor (non-passive so we can preventDefault).
  useEffect(() => {
    const el = containerRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = useViewStore.getState()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left - rect.width / 2
      const py = e.clientY - rect.top - rect.height / 2
      // Normalize Firefox line-mode deltas (~16px/line) to pixel-mode.
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      const z0 = s.cam.zoom
      const z1 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z0 * Math.exp(-delta * CAM.wheelSpeed)))
      const wx = s.cam.x + px / z0
      const wy = s.cam.y + py / z0
      anim.current.target = { x: wx - px / z1, y: wy - py / z1, zoom: z1 }
      anim.current.rate = CAM.wheelRate
      anim.current.active = true
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Keyboard: ESC release, Delete/L/N on the selection, ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.isComposing) return // don't fire hotkeys mid-IME composition
      const view = useViewStore.getState()
      const worldStore = useWorldStore.getState()
      if (e.key === 'Escape') {
        view.select(null)
        worldStore.setEditing(null)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && view.selectedId) {
        e.preventDefault()
        worldStore.removeNode(view.selectedId)
      } else if (e.key.toLowerCase() === 'l' && view.selectedId) {
        worldStore.toggleLock(view.selectedId)
      } else if (e.key.toLowerCase() === 'c' && view.selectedId) {
        worldStore.addChild(view.selectedId)
      } else if (e.key.toLowerCase() === 'n') {
        worldStore.addNode([view.cam.x, view.cam.y])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Click a node label → ease the camera to it. Zoom past the pass-through
  // point (zoom = hierarchy), so selecting a parent lands you *inside* its
  // room with the family spread around you, not hovering above the ring.
  useEffect(() => {
    if (!selectedId) return
    const world = useWorldStore.getState().world
    const node = world.nodeById.get(selectedId)
    if (!node) return
    const { cam, zRooms, zCards } = useViewStore.getState()
    const depth = world.depthById.get(selectedId) ?? 0
    const hasKids = (world.childrenByParent.get(selectedId)?.length ?? 0) > 0
    const targetZoom = hasKids
      ? revealZoom(depth + 1, zCards) * INTERACT.focusKidsZoom
      : Math.max(zRooms * INTERACT.focusMinZoom, revealZoom(depth, zCards) * INTERACT.focusLeafZoom)
    anim.current.target = {
      x: node.position[0],
      y: node.position[1],
      zoom: Math.min(MAX_ZOOM, Math.max(cam.zoom, targetZoom)),
    }
    anim.current.rate = CAM.focusRate
    anim.current.active = true
  }, [selectedId])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
    anim.current.active = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const s = useViewStore.getState()
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true
    drag.current.x = e.clientX
    drag.current.y = e.clientY
    s.setCam({ ...s.cam, x: s.cam.x - dx / s.cam.zoom, y: s.cam.y - dy / s.cam.zoom })
  }
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) {
      useViewStore.getState().select(null)
      useWorldStore.getState().setEditing(null)
    }
    drag.current = null
  }

  // Double-click empty canvas → create a note at the cursor (cards/chips
  // stopPropagation on double-click, so this only fires on empty space).
  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = containerRef.current!
    const rect = el.getBoundingClientRect()
    const { cam } = useViewStore.getState()
    const px = e.clientX - rect.left - rect.width / 2
    const py = e.clientY - rect.top - rect.height / 2
    useWorldStore.getState().addNode([cam.x + px / cam.zoom, cam.y + py / cam.zoom])
  }

  return (
    <div
      ref={containerRef}
      className="board"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <DotsCanvas />
      <div ref={worldRef} className="world">
        <ClusterLabels />
      </div>
      <NodeLabelLayer />
    </div>
  )
}
