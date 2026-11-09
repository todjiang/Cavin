import { useEffect, useRef } from 'react'
import { hsla, groupsByDepth, lodLevels, roomMorph, roomRadiusEase } from '@cavin/core'
import type { GroupCluster } from '@cavin/core'
import { useCavin } from '../context'
import { paletteMemo } from '../presentation'


/**
 * Canvas layer: node dots (colored by top-level group via the adapter, sized
 * by the time slider, children smaller/dimmer by depth), cluster boundaries
 * that grow as you zoom into a family, faint parent→child edges, and blurred
 * cluster blobs that get more visible as you zoom out. Dots sit at their
 * room-morph position: clustered while the family is closed, spread onto the
 * room's ring once it opens. Redrawn every frame from the store camera.
 */
export function DotsCanvas() {
  const { adapter, view: useView, world: useWorld, config, frame } = useCavin()
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const { blobs: BLOBS, edges: EDGES, importance: IMPORTANCE } = config
    const paletteOf = paletteMemo(adapter, config)
    let raf = 0
    // Dirty-check: skip the full redraw while nothing the canvas depends on
    // has changed (idle), instead of re-rasterizing every frame.
    let lastCam: unknown = null
    let lastWorld: unknown = null
    let lastTimeT = -1
    let lastZRooms = -1
    let lastZCards = -1
    let lastSelected: unknown = null
    // Whether the last drawn frame had a focus — while true and the shared
    // blend (advanced once per frame in Board's tick) is still converging,
    // keep redrawing so the gather animation plays out.
    let hadFocus = false

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const { cam, zRooms, zCards, timeT, selectedId } = useView.getState()
      const world = useWorld.getState().world
      const palette = paletteOf(world)
      const gathering = hadFocus && frame.focusBlend() < 1
      if (cam === lastCam && world === lastWorld && timeT === lastTimeT && zRooms === lastZRooms && zCards === lastZCards && selectedId === lastSelected && !gathering) return
      lastCam = cam
      lastWorld = world
      lastTimeT = timeT
      lastZRooms = zRooms
      lastZCards = zCards
      lastSelected = selectedId
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
      // Only human-confirmed connections are drawn on the canvas. Machine
      // suggestions still surface in the detail panel, but not as dashed
      // arcs across the map — they read as noise and are easy to confuse
      // with the parent→child tree.
      const confirmedEdges = world.edges.filter((e) => e.kind === 'confirmed')
      // The scene IS the frame: one shared morph cache (see the contract on
      // Scene.morphs), one visibility walk, screen positions ready to paint.
      // Cull padding = dot radius.
      const scene = frame.scene(world, cam, zCards, selectedId, { w, h }, config.scene.dotMargin)
      const { entries, morphs } = scene
      const sx = (wx: number) => scene.project(wx, 0)[0]
      const sy = (wy: number) => scene.project(0, wy)[1]
      const morphOf = (id: string) => {
        const n = world.nodeById.get(id)!
        return roomMorph(world, n, cam.zoom, cam, zCards, morphs, config)
      }

      // Selection spotlight: confirmed edges touching the selected node are
      // drawn brighter, thicker and on top — with their relation labels.
      // When the node HAS confirmed edges this becomes a focus mode: the
      // spotlight set (relations + tree context) is the only thing drawn at
      // full strength; every other dot, label and arc leaves the stage.
      const focus = scene.focus
      const spotEdges = new Set<string>()
      const spotNodes = new Set<string>()
      if (focus) {
        for (const id of focus.edgeIds) spotEdges.add(id)
        for (const id of focus.nodeIds) spotNodes.add(id)
      } else if (selectedId) {
        spotNodes.add(selectedId)
        for (const e of world.edgesByNode.get(selectedId) ?? []) {
          if (e.kind !== 'confirmed') continue
          spotEdges.add(e.id)
          spotNodes.add(e.from === selectedId ? e.to : e.from)
        }
      }
      const spotlight = spotEdges.size > 0

      // Constellation: the focus ring eases in over a few frames. The blend
      // itself advances once per frame in Board's tick — this layer (and the
      // label layer) only read the eased value. Display positions blend
      // between each node's room-morph home and its ring slot — the world
      // itself never moves.
      hadFocus = focus != null
      const focusK = scene.focusK
      const ringTargets = scene.ringTargets
      const dispOf = (id: string): [number, number] => {
        const base = (morphs.get(id) ?? morphOf(id)).pos
        const t = ringTargets.get(id)
        if (!t) return base
        return [base[0] + (t[0] - base[0]) * focusK, base[1] + (t[1] - base[1]) * focusK]
      }
      // Focus overrides the zoom gates: the constellation's dots and arcs
      // stay on screen at any zoom, with dots at a constant screen size.
      const dotsLv = focus ? Math.max(lv.dots, focusK) : lv.dots
      const edgeLabelsOn = cam.zoom >= zRooms * 0.8

      // Blurred blobs: soft glow per cluster band, rising as you zoom out.
      // Bands come from the world — one pass per grouping depth present.
      if (lv.blobs > 0.01) {
        const drawBand = (groups: GroupCluster[], isTop: boolean) => {
          for (const cluster of groups) {
            const x = sx(cluster.centroid[0])
            const y = sy(cluster.centroid[1])
            const r = cluster.radius * (isTop ? BLOBS.topRadiusFactor : BLOBS.subRadiusFactor) * cam.zoom
            if (r < 2 || x < -r || x > w + r || y < -r || y > h + r) continue
            const g = ctx.createRadialGradient(x, y, 0, x, y, r)
            if (isTop) {
              g.addColorStop(0, hsla(palette.clusterHue(cluster), 0.1 * lv.blobs, config))
              g.addColorStop(1, hsla(palette.clusterHue(cluster), 0, config))
            } else {
              g.addColorStop(0, hsla(palette.clusterHue(cluster), 0.28 * lv.blobs, config))
              g.addColorStop(0.7, hsla(palette.clusterHue(cluster), 0.1 * lv.blobs, config))
              g.addColorStop(1, hsla(palette.clusterHue(cluster), 0, config))
            }
            ctx.fillStyle = g
            ctx.fillRect(x - r, y - r, r * 2, r * 2)
          }
        }
        const bands = groupsByDepth(world)
        if (bands.length > 0) drawBand(bands[0], true) // bands[0] IS depth 0
        for (const sub of bands.slice(1)) drawBand(sub, false)
      }

      // Cross-domain arcs, zoomed out: edges aggregate into top-level
      // group↔group bundles between centroids — a map of which domains are
      // most entangled. A hue gradient along the arc reads as "from this
      // domain to that one". While a selection is active, bundles carrying
      // one of its edges stay bright and the rest step back.
      if (lv.blobs > 0.01 && confirmedEdges.length > 0) {
        const bundles = new Map<
          string,
          { a: GroupCluster; b: GroupCluster; count: number; spot: boolean }
        >()
        for (const e of confirmedEdges) {
          const na = world.nodeById.get(e.from)
          const nb = world.nodeById.get(e.to)
          const ga = na?.groupPath[0]
          const gb = nb?.groupPath[0]
          if (!na || !nb || !ga || !gb || ga === gb) continue
          const [wa, wb] = ga < gb ? ([ga, gb] as const) : ([gb, ga] as const)
          const key = `${wa}|${wb}`
          const spot = spotEdges.has(e.id)
          const bundle = bundles.get(key)
          if (bundle) {
            bundle.count++
            bundle.spot ||= spot
          } else {
            bundles.set(key, {
              a: world.groupByPath.get(wa)!,
              b: world.groupByPath.get(wb)!,
              count: 1,
              spot,
            })
          }
        }
        for (const [key, { a, b, count, spot }] of bundles) {
          if (focus && !spot) continue // focus mode: only the selected node's bundles stay
          const x1 = sx(a.centroid[0])
          const y1 = sy(a.centroid[1])
          const x2 = sx(b.centroid[0])
          const y2 = sy(b.centroid[1])
          if ((x1 < -60 && x2 < -60) || (x1 > w + 60 && x2 > w + 60) || (y1 < -60 && y2 < -60) || (y1 > h + 60 && y2 > h + 60)) continue
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const dist = Math.hypot(x2 - x1, y2 - y1)
          if (dist < 1) continue
          // Deterministic bend direction per pair so the arc is stable
          // across frames and zooms.
          let hash = 0
          for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
          const side = (hash >>> 8) % 2 === 0 ? 1 : -1
          const cx = mx + (-(y2 - y1) / dist) * dist * EDGES.arcBend * side
          const cy = my + ((x2 - x1) / dist) * dist * EDGES.arcBend * side
          const alpha = (spot ? EDGES.bundleSpotAlpha : 0.4 * (spotlight ? EDGES.dimFactor : 1)) * lv.blobs
          const grad = ctx.createLinearGradient(x1, y1, x2, y2)
          grad.addColorStop(0, hsla(palette.clusterHue(a), alpha, config))
          grad.addColorStop(1, hsla(palette.clusterHue(b), alpha, config))
          ctx.strokeStyle = grad
          ctx.lineWidth = EDGES.arcWidthBase + EDGES.arcWidthPerEdge * Math.log(count)
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.quadraticCurveTo(cx, cy, x2, y2)
          ctx.stroke()
        }
      }

      // Cluster boundaries: a soft glowing circle grows around each parent as
      // its room opens — the "walls" of the room the family lives in. Once
      // the camera passes through (m.pass → 1) the walls fade away: you are
      // inside now, and the children own the view.
      if (lv.dots > 0.01) {
        for (const { node: n, morph: m, offscreen } of entries) {
          if (offscreen) continue
          if (!world.childrenByParent.has(n.id)) continue
          if (focus && !focus.nodeIds.has(n.id)) continue
          const wall = m.roomOpen * (1 - m.pass)
          if (wall < 0.02) continue
          const dp = focus ? dispOf(n.id) : m.pos
          const x = sx(dp[0])
          const y = sy(dp[1])
          const r = m.roomR * cam.zoom * roomRadiusEase(m.roomOpen, config)
          if (x < -r || x > w + r || y < -r || y > h + r) continue
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = hsla(palette.nodeHue(n), 0.06 * wall, config)
          ctx.fill()
          ctx.lineWidth = 1.5
          ctx.strokeStyle = hsla(palette.nodeHue(n), 0.5 * wall, config)
          ctx.stroke()
        }
      }

      // Parent→child edges: faint links between morph positions. Closed
      // families huddle (edges collapse); opened rooms show spokes.
      if (lv.dots > 0.25) {
        ctx.lineWidth = 1
        for (const { node: n, morph: m, offscreen } of entries) {
          if (offscreen) continue
          if (!n.parentId) continue
          if (focus && (!focus.nodeIds.has(n.id) || !focus.nodeIds.has(n.parentId))) continue
          const parent = world.nodeById.get(n.parentId)
          if (!parent) continue
          // A visible unplaced child's ancestors are already in the cache;
          // a placed child's parent may not be — compute it on demand.
          const pm = morphs.get(parent.id) ?? morphOf(parent.id)
          const cdp = focus ? dispOf(n.id) : m.pos
          const pdp = focus ? dispOf(parent.id) : pm.pos
          const dist =
            Math.hypot(cdp[0] - pdp[0], cdp[1] - pdp[1]) * cam.zoom
          if (dist <= 3) continue
          const alpha = 0.24 * lv.dots * Math.max(0.2, m.open)
          const x1 = sx(pdp[0])
          const y1 = sy(pdp[1])
          const x2 = sx(cdp[0])
          const y2 = sy(cdp[1])
          if ((x1 < -40 && x2 < -40) || (x1 > w + 40 && x2 > w + 40) || (y1 < -40 && y2 < -40) || (y1 > h + 40 && y2 > h + 40)) continue
          ctx.strokeStyle = hsla(palette.nodeHue(n), alpha, config)
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
      }

      // Cross-domain thin lines, zoomed in: when both endpoints are on
      // screen, draw a curved link between their morph positions — the curve
      // distinguishes them from the straight parent→child spokes. Under a
      // selection, the node's own edges are held back and drawn last:
      // brighter, thicker, and annotated with the relation label at the
      // arc's midpoint.
      if (dotsLv > 0.25 && confirmedEdges.length > 0) {
        const visIds = new Set(entries.map((v) => v.node.id))
        const held: { e: (typeof confirmedEdges)[number]; g: [number, number, number, number, number, number] }[] = []
        for (const e of confirmedEdges) {
          if (focus && !focus.edgeIds.has(e.id)) continue
          // In focus mode the constellation pulls off-screen relations into
          // view, so the usual "both endpoints visible" cull doesn't apply.
          if (!focus && (!visIds.has(e.from) || !visIds.has(e.to))) continue
          const na = world.nodeById.get(e.from)!
          const nb = world.nodeById.get(e.to)!
          const pa = dispOf(na.id)
          const pb = dispOf(nb.id)
          const x1 = sx(pa[0])
          const y1 = sy(pa[1])
          const x2 = sx(pb[0])
          const y2 = sy(pb[1])
          if ((x1 < -40 && x2 < -40) || (x1 > w + 40 && x2 > w + 40) || (y1 < -40 && y2 < -40) || (y1 > h + 40 && y2 > h + 40)) continue
          const dist = Math.hypot(x2 - x1, y2 - y1)
          if (dist <= 3) continue
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const cx = mx + (-(y2 - y1) / dist) * dist * EDGES.arcBend
          const cy = my + ((x2 - x1) / dist) * dist * EDGES.arcBend
          if (spotEdges.has(e.id)) {
            held.push({ e, g: [x1, y1, cx, cy, x2, y2] })
            continue
          }
          const alpha = 0.55 * (spotlight ? EDGES.dimFactor : 1) * dotsLv
          const grad = ctx.createLinearGradient(x1, y1, x2, y2)
          grad.addColorStop(0, hsla(palette.nodeHue(na), alpha, config))
          grad.addColorStop(1, hsla(palette.nodeHue(nb), alpha, config))
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.quadraticCurveTo(cx, cy, x2, y2)
          ctx.stroke()
        }
        for (const [hi, { e, g }] of held.entries()) {
          const [x1, y1, cx, cy, x2, y2] = g
          const na = world.nodeById.get(e.from)!
          const nb = world.nodeById.get(e.to)!
          const alpha = EDGES.spotlightAlpha * dotsLv * (focus ? focusK : 1)
          const grad = ctx.createLinearGradient(x1, y1, x2, y2)
          grad.addColorStop(0, hsla(palette.nodeHue(na), alpha, config))
          grad.addColorStop(1, hsla(palette.nodeHue(nb), alpha, config))
          ctx.strokeStyle = grad
          ctx.lineWidth = EDGES.spotlightWidth
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.quadraticCurveTo(cx, cy, x2, y2)
          ctx.stroke()
          const dist = Math.hypot(x2 - x1, y2 - y1)
          // Zoomed out the constellation ring is dense with chips — arc
          // labels would pile up, so they only appear from room zoom inward.
          if (!e.label || dist < EDGES.labelMinDist || (focus && !edgeLabelsOn)) continue
          const text =
            e.label.length > EDGES.labelMaxLen
              ? `${e.label.slice(0, EDGES.labelMaxLen)}…`
              : e.label
          // Labels alternate between two radii along the arc so neighbors on
          // the constellation ring don't stack their labels on one circle.
          const t = hi % 2 === 0 ? 0.4 : 0.62
          const u = 1 - t
          const lx = u * u * x1 + 2 * u * t * cx + t * t * x2
          const ly = u * u * y1 + 2 * u * t * cy + t * t * y2
          ctx.font = `${EDGES.labelFontSize}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const tw = ctx.measureText(text).width
          ctx.fillStyle = `rgba(8, 8, 14, ${0.72 * dotsLv * (focus ? focusK : 1)})`
          ctx.fillRect(lx - tw / 2 - 4, ly - EDGES.labelFontSize / 2 - 3, tw + 8, EDGES.labelFontSize + 6)
          ctx.fillStyle = `rgba(255, 255, 255, ${0.92 * dotsLv * (focus ? focusK : 1)})`
          ctx.fillText(text, lx, ly)
        }
      }

      // Node dots at their display positions (room-morph home, blended onto
      // the constellation ring while a focus gathers). Parents get a faint
      // ring — the "this note is a room" signal visible all the way out to
      // the star-field view. Hub notes (more connections) sit larger and
      // brighter. In focus mode only the spotlight set appears at all, and
      // the related nodes get a bright halo ring.
      if (dotsLv > 0.01) {
        const rScale = Math.sqrt(cam.zoom)
        const maxDeg = world.maxDegree || 1
        const drawDot = (n: Parameters<typeof palette.nodeColor>[0], pos: [number, number]) => {
          const x = sx(pos[0])
          const y = sy(pos[1])
          if (x < -8 || x > w + 8 || y < -8 || y > h + 8) return
          const tf = palette.timeDim(n, timeT)
          const depth = world.depthById.get(n.id) ?? 0
          const depthDim = Math.max(0.45, 1 - depth * 0.18)
          const spotDim = spotlight && !focus && !spotNodes.has(n.id) ? EDGES.dotDimFactor : 1
          const imp = (world.degreeById.get(n.id) ?? 0) / maxDeg
          const alpha = Math.min(
            1,
            dotsLv * (0.2 + 0.8 * tf) * depthDim * spotDim * (1 + IMPORTANCE.alphaBoost * imp),
          )
          // Focus members get a constant SCREEN size so the constellation
          // reads at any zoom; everyone else scales with the camera.
          const r = focus
            ? 2.2 + 2.4 * imp + (n.id === focus.id ? 1.2 : 0)
            : Math.max(0.7, (1.3 + 2.1 * tf) * rScale * depthDim * (1 + IMPORTANCE.sizeBoost * imp))
          ctx.globalAlpha = alpha
          ctx.fillStyle = palette.nodeColor(n)
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
          if (world.childrenByParent.has(n.id)) {
            ctx.globalAlpha = alpha * 0.75
            ctx.strokeStyle = palette.nodeColor(n)
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(x, y, r + (focus ? 2 : 1.8 * rScale), 0, Math.PI * 2)
            ctx.stroke()
          }
          if (focus && n.id !== focus.id) {
            ctx.globalAlpha = EDGES.focusRingAlpha * dotsLv * focusK
            ctx.strokeStyle = palette.nodeColor(n)
            ctx.lineWidth = 1.4
            ctx.beginPath()
            ctx.arc(x, y, r + EDGES.focusRingPad, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
        // Entries already include the constellation members the focus ring
        // pulled in from off-screen (flagged `offscreen`) — one loop covers
        // visible and gathered nodes alike.
        for (const { node: n } of entries) {
          if (focus && !focus.nodeIds.has(n.id)) continue
          drawDot(n, dispOf(n.id))
        }
        ctx.globalAlpha = 1
      }
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [adapter, useView, useWorld, frame])

  return <canvas ref={ref} className="dots-canvas" />
}
