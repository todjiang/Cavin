import { useEffect, useRef } from 'react'
import { hsla, timeFactor } from '../data/layout'
import { useViewStore } from '../store'
import { useWorldStore } from '../store/world'
import { lodLevels, roomMorph, roomRadiusEase, visibleNodes } from './lod'
import type { RoomMorph, VisibleEntry } from './lod'

/**
 * Canvas layer: node dots (colored by wing, sized/brightened by the time
 * slider, children smaller/dimmer by depth), room boundaries that grow as
 * you zoom into a family, faint parent→child edges, and blurred cluster
 * blobs that get more visible as you zoom out. Dots sit at their room-morph
 * position: clustered while the family is closed, spread onto the room's
 * ring once it opens. Redrawn every frame from the store camera.
 */
export function DotsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    // Dirty-check: skip the full redraw while nothing the canvas depends on
    // has changed (idle), instead of re-rasterizing every frame.
    let lastCam: unknown = null
    let lastWorld: unknown = null
    let lastTimeT = -1
    let lastZRooms = -1
    let lastZCards = -1

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const { cam, zRooms, zCards, timeT } = useViewStore.getState()
      const world = useWorldStore.getState().world
      if (cam === lastCam && world === lastWorld && timeT === lastTimeT && zRooms === lastZRooms && zCards === lastZCards) return
      lastCam = cam
      lastWorld = world
      lastTimeT = timeT
      lastZRooms = zRooms
      lastZCards = zCards
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const lv = lodLevels(cam.zoom, zRooms, zCards)
      const sx = (wx: number) => w / 2 + (wx - cam.x) * cam.zoom
      const sy = (wy: number) => h / 2 + (wy - cam.y) * cam.zoom
      // One morph cache shared by rooms, edges and dots this frame; the
      // visible list is walked top-down so closed off-screen subtrees are
      // never recursed into. Computed lazily — blobs don't need morphs.
      const morph = new Map<string, RoomMorph>()
      let visible: VisibleEntry[] | null = null
      const vis = () => (visible ??= visibleNodes(world, cam, w, h, zCards, 8, morph))
      const morphOf = (id: string) => {
        const n = world.nodeById.get(id)!
        return roomMorph(world, n, cam.zoom, cam, zCards, morph)
      }

      // Blurred blobs: soft wing glow + room blobs, rising as you zoom out.
      if (lv.blobs > 0.01) {
        for (const wing of world.wings) {
          const x = sx(wing.centroid[0])
          const y = sy(wing.centroid[1])
          const r = wing.radius * 1.15 * cam.zoom
          if (r < 2 || x < -r || x > w + r || y < -r || y > h + r) continue
          const g = ctx.createRadialGradient(x, y, 0, x, y, r)
          g.addColorStop(0, hsla(wing.hue, 0.1 * lv.blobs))
          g.addColorStop(1, hsla(wing.hue, 0))
          ctx.fillStyle = g
          ctx.fillRect(x - r, y - r, r * 2, r * 2)
        }
        for (const room of world.rooms) {
          const x = sx(room.centroid[0])
          const y = sy(room.centroid[1])
          const r = room.radius * 1.6 * cam.zoom
          if (r < 2 || x < -r || x > w + r || y < -r || y > h + r) continue
          const g = ctx.createRadialGradient(x, y, 0, x, y, r)
          g.addColorStop(0, hsla(room.hue, 0.28 * lv.blobs))
          g.addColorStop(0.7, hsla(room.hue, 0.1 * lv.blobs))
          g.addColorStop(1, hsla(room.hue, 0))
          ctx.fillStyle = g
          ctx.fillRect(x - r, y - r, r * 2, r * 2)
        }
      }

      // Room boundaries: a soft glowing circle grows around each parent as
      // its room opens — the "walls" of the room the family lives in. Once
      // the camera passes through (m.pass → 1) the walls fade away: you are
      // inside now, and the children own the view.
      if (lv.dots > 0.01) {
        for (const { node: n, morph: m } of vis()) {
          if (!world.childrenByParent.has(n.id)) continue
          const wall = m.roomOpen * (1 - m.pass)
          if (wall < 0.02) continue
          const x = sx(m.pos[0])
          const y = sy(m.pos[1])
          const r = m.roomR * cam.zoom * roomRadiusEase(m.roomOpen)
          if (x < -r || x > w + r || y < -r || y > h + r) continue
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = hsla(n.hue, 0.06 * wall)
          ctx.fill()
          ctx.lineWidth = 1.5
          ctx.strokeStyle = hsla(n.hue, 0.5 * wall)
          ctx.stroke()
        }
      }

      // Parent→child edges: faint links between morph positions. Closed
      // families huddle (edges collapse); opened rooms show spokes.
      if (lv.dots > 0.25) {
        ctx.lineWidth = 1
        for (const { node: n, morph: m } of vis()) {
          if (!n.parentId) continue
          const parent = world.nodeById.get(n.parentId)
          if (!parent) continue
          // A visible unplaced child's ancestors are already in the cache;
          // a placed child's parent may not be — compute it on demand.
          const pm = morph.get(parent.id) ?? morphOf(parent.id)
          const dist =
            Math.hypot(m.pos[0] - pm.pos[0], m.pos[1] - pm.pos[1]) * cam.zoom
          if (dist <= 3) continue
          const alpha = 0.24 * lv.dots * Math.max(0.2, m.open)
          const x1 = sx(pm.pos[0])
          const y1 = sy(pm.pos[1])
          const x2 = sx(m.pos[0])
          const y2 = sy(m.pos[1])
          if ((x1 < -40 && x2 < -40) || (x1 > w + 40 && x2 > w + 40) || (y1 < -40 && y2 < -40) || (y1 > h + 40 && y2 > h + 40)) continue
          ctx.strokeStyle = hsla(n.hue, alpha)
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
      }

      // Node dots at their room-morph positions. Parents get a faint ring —
      // the "this note is a room" signal visible all the way out to the
      // star-field view.
      if (lv.dots > 0.01) {
        const rScale = Math.sqrt(cam.zoom)
        for (const { node: n, morph: m } of vis()) {
          const x = sx(m.pos[0])
          const y = sy(m.pos[1])
          if (x < -8 || x > w + 8 || y < -8 || y > h + 8) continue
          const tf = timeFactor(n.createdAt, timeT)
          const depth = world.depthById.get(n.id) ?? 0
          const depthDim = Math.max(0.45, 1 - depth * 0.18)
          const alpha = lv.dots * (0.2 + 0.8 * tf) * depthDim
          const r = Math.max(0.7, (1.3 + 2.1 * tf) * rScale * depthDim)
          ctx.globalAlpha = alpha
          ctx.fillStyle = n.color
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
          if (world.childrenByParent.has(n.id)) {
            ctx.globalAlpha = alpha * 0.75
            ctx.strokeStyle = n.color
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(x, y, r + 1.8 * rScale, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
        ctx.globalAlpha = 1
      }
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} className="dots-canvas" />
}
