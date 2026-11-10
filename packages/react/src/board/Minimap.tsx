import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { groupsByDepth, hsla } from '@cavin/core'
import { useCavin } from '../context'
import { paletteMemo } from '../presentation'

const MAP_W = 180
const MAP_H = 120
const PAD = 8

/** World→map transform, recomputed per frame inside each instance — never
    module state, so two canvases on one page cannot fight over the bounds. */
interface MapBounds {
  minX: number
  minY: number
  scale: number
  ox: number
  oy: number
}

function computeBounds(positions: readonly [number, number][]): MapBounds {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [px, py] of positions) {
    if (px < x0) x0 = px
    if (py < y0) y0 = py
    if (px > x1) x1 = px
    if (py > y1) y1 = py
  }
  if (!Number.isFinite(x0)) {
    x0 = y0 = -1
    x1 = y1 = 1
  }
  x0 -= 120
  y0 -= 120
  x1 += 120
  y1 += 120
  const scale = Math.min((MAP_W - PAD * 2) / (x1 - x0), (MAP_H - PAD * 2) / (y1 - y0))
  return {
    minX: x0,
    minY: y0,
    scale,
    ox: PAD + ((MAP_W - PAD * 2) - (x1 - x0) * scale) / 2,
    oy: PAD + ((MAP_H - PAD * 2) - (y1 - y0) * scale) / 2,
  }
}

/**
 * Corner minimap: top-level tint regions + tiny node dots + region name
 * labels (top-level names always, sub-cluster names when their circle can
 * carry text, greedy map-space declutter) + the current viewport rectangle.
 * Click/drag jumps the camera there. Redrawn every frame.
 */
export function Minimap() {
  const { adapter, view: useView, world: useWorld, config } = useCavin()
  const ref = useRef<HTMLCanvasElement>(null)
  const dragging = useRef(false)
  // Per-instance world→map transform: written by the draw loop each frame,
  // read by jump() — shared through a ref, never through module state.
  const boundsRef = useRef<MapBounds>({ minX: 0, minY: 0, scale: 1, ox: 0, oy: 0 })
  const toMapX = (wx: number) => {
    const b = boundsRef.current
    return b.ox + (wx - b.minX) * b.scale
  }
  const toMapY = (wy: number) => {
    const b = boundsRef.current
    return b.oy + (wy - b.minY) * b.scale
  }
  const toWorldX = (mx: number) => {
    const b = boundsRef.current
    return b.minX + (mx - b.ox) / b.scale
  }
  const toWorldY = (my: number) => {
    const b = boundsRef.current
    return b.minY + (my - b.oy) / b.scale
  }

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const paletteOf = paletteMemo(adapter, config)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = MAP_W * dpr
    canvas.height = MAP_H * dpr
    let raf = 0
    let lastCam: unknown = null
    let lastWorld: unknown = null
    let lastTimeT = -1

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const { cam, timeT } = useView.getState()
      const world = useWorld.getState().world
      if (cam === lastCam && world === lastWorld && timeT === lastTimeT) return
      lastCam = cam
      lastWorld = world
      lastTimeT = timeT
      const palette = paletteOf(world)
      boundsRef.current = computeBounds(world.nodes.map((n) => n.position))
      const { scale } = boundsRef.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, MAP_W, MAP_H)

      const bands = groupsByDepth(world)
      // bands[0] IS depth 0 — the top-level geography discs.
      for (const top of bands[0] ?? []) {
        ctx.fillStyle = hsla(palette.clusterHue(top), 0.12, config)
        ctx.beginPath()
        ctx.arc(toMapX(top.centroid[0]), toMapY(top.centroid[1]), top.radius * scale, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const n of world.nodes) {
        ctx.globalAlpha = 0.25 + 0.75 * palette.timeDim(n, timeT)
        ctx.fillStyle = palette.nodeColor(n)
        ctx.fillRect(toMapX(n.position[0]) - 0.5, toMapY(n.position[1]) - 0.5, 1.4, 1.4)
      }
      ctx.globalAlpha = 1

      // Region labels so the map is orientable at a glance: top-level names
      // always; deeper-band names only where their circle is big enough.
      // Greedy collision rejection keeps them from stacking.
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
      for (const top of bands[0] ?? []) {
        tryLabel(
          toMapX(top.centroid[0]),
          toMapY(top.centroid[1]),
          top.name,
          hsla(palette.clusterHue(top), 0.95, config),
          '600 7px system-ui, sans-serif',
        )
      }
      for (const sub of bands.slice(1).flat()) {
        if (sub.radius * scale < 9) continue
        tryLabel(
          toMapX(sub.centroid[0]),
          toMapY(sub.centroid[1]),
          sub.name,
          hsla(palette.clusterHue(sub), 0.7, config),
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
  }, [adapter, useView, useWorld])

  const jump = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = ref.current!.getBoundingClientRect()
    const s = useView.getState()
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
