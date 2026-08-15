import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { hsla, timeFactor } from '../data/layout'
import { useViewStore } from '../store'
import { useWorldStore } from '../store/world'

const MAP_W = 180
const MAP_H = 120
const PAD = 8

// World bounds from node extents — recomputed every frame since nodes can
// now be dragged anywhere, created, and deleted.
let minX = 0
let minY = 0
let scale = 1
let ox = 0
let oy = 0

function updateBounds() {
  const { nodes } = useWorldStore.getState().world
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const n of nodes) {
    if (n.position[0] < x0) x0 = n.position[0]
    if (n.position[1] < y0) y0 = n.position[1]
    if (n.position[0] > x1) x1 = n.position[0]
    if (n.position[1] > y1) y1 = n.position[1]
  }
  if (!Number.isFinite(x0)) {
    x0 = y0 = -1
    x1 = y1 = 1
  }
  x0 -= 120
  y0 -= 120
  x1 += 120
  y1 += 120
  minX = x0
  minY = y0
  scale = Math.min((MAP_W - PAD * 2) / (x1 - x0), (MAP_H - PAD * 2) / (y1 - y0))
  ox = PAD + ((MAP_W - PAD * 2) - (x1 - x0) * scale) / 2
  oy = PAD + ((MAP_H - PAD * 2) - (y1 - y0) * scale) / 2
}

const toMapX = (wx: number) => ox + (wx - minX) * scale
const toMapY = (wy: number) => oy + (wy - minY) * scale
const toWorldX = (mx: number) => minX + (mx - ox) / scale
const toWorldY = (my: number) => minY + (my - oy) / scale

/**
 * Corner minimap: wing tint regions + tiny node dots + region name labels
 * (wing names always, room names when their circle can carry text, greedy
 * map-space declutter) + the current viewport rectangle. Click/drag jumps
 * the camera there. Redrawn every frame.
 */
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null)
  const dragging = useRef(false)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = MAP_W * dpr
    canvas.height = MAP_H * dpr
    let raf = 0
    let lastCam: unknown = null
    let lastWorld: unknown = null
    let lastTimeT = -1

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const { cam, timeT } = useViewStore.getState()
      const world = useWorldStore.getState().world
      if (cam === lastCam && world === lastWorld && timeT === lastTimeT) return
      lastCam = cam
      lastWorld = world
      lastTimeT = timeT
      updateBounds()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, MAP_W, MAP_H)

      for (const wing of world.wings) {
        ctx.fillStyle = hsla(wing.hue, 0.12)
        ctx.beginPath()
        ctx.arc(toMapX(wing.centroid[0]), toMapY(wing.centroid[1]), wing.radius * scale, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const n of world.nodes) {
        ctx.globalAlpha = 0.25 + 0.75 * timeFactor(n.createdAt, timeT)
        ctx.fillStyle = n.color
        ctx.fillRect(toMapX(n.position[0]) - 0.5, toMapY(n.position[1]) - 0.5, 1.4, 1.4)
      }
      ctx.globalAlpha = 1

      // Region labels so the map is orientable at a glance: wing names
      // always; room names only where their circle is big enough. Greedy
      // collision rejection keeps them from stacking.
      const labelRects: { x0: number; y0: number; x1: number; y1: number }[] = []
      const tryLabel = (x: number, y: number, text: string, color: string, font: string) => {
        ctx.font = font
        const tw = ctx.measureText(text).width
        const r = { x0: x - tw / 2 - 1.5, y0: y - 4, x1: x + tw / 2 + 1.5, y1: y + 4 }
        if (r.x0 < 1 || r.x1 > MAP_W - 1 || r.y0 < 1 || r.y1 > MAP_H - 1) return
        if (labelRects.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0))
          return
        labelRects.push(r)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = color
        ctx.fillText(text, x, y)
      }
      for (const wing of world.wings) {
        tryLabel(
          toMapX(wing.centroid[0]),
          toMapY(wing.centroid[1]),
          wing.name,
          hsla(wing.hue, 0.95),
          '600 7px system-ui, sans-serif',
        )
      }
      for (const room of world.rooms) {
        if (room.radius * scale < 9) continue
        tryLabel(
          toMapX(room.centroid[0]),
          toMapY(room.centroid[1]),
          room.name,
          hsla(room.hue, 0.7),
          '6px system-ui, sans-serif',
        )
      }

      const vw = window.innerWidth / cam.zoom
      const vh = window.innerHeight / cam.zoom
      ctx.strokeStyle = 'rgba(230, 238, 250, 0.85)'
      ctx.lineWidth = 1
      ctx.strokeRect(
        toMapX(cam.x - vw / 2),
        toMapY(cam.y - vh / 2),
        vw * scale,
        vh * scale,
      )
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const jump = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = ref.current!.getBoundingClientRect()
    const s = useViewStore.getState()
    s.setCam({
      ...s.cam,
      x: toWorldX(e.clientX - rect.left),
      y: toWorldY(e.clientY - rect.top),
    })
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
    jump(e)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragging.current) jump(e)
  }
  const onPointerUp = () => {
    dragging.current = false
  }

  return (
    <canvas
      ref={ref}
      className="minimap"
      style={{ width: MAP_W, height: MAP_H }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}
