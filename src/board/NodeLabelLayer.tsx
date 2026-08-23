import { useEffect, useRef } from 'react'
import { focusForSelection, smoothstep, timeFactor } from '../data/layout'
import type { LaidOutNode } from '../data/layout'
import { useViewStore } from '../store'
import { useWorldStore } from '../store/world'
import { layoutConfig } from '../config'
import { chipOpacity, focusRingTargets, roomMorph, roomRadius, roomRadiusEase, visibleNodes, MAX_CHIPS } from './lod'
import type { RoomMorph } from './lod'

const { labels: LABELS, interaction: INTERACT, focus: FOCUS } = layoutConfig

/** Click vs drag: pointer must travel this many screen px to become a drag. */
const DRAG_THRESHOLD = INTERACT.dragThreshold
/** Drop-target snap radius (screen px): within this of another node's dot,
    releasing the drag re-parents instead of free-placing. */
const DROP_RADIUS = INTERACT.dropRadius
const CHIP_H = LABELS.chipHeight
const CHIP_MAX_W = LABELS.chipMaxWidth
/** A parent's label becomes the room's nameplate once its room is this open. */
const NAMEPLATE_OPEN = LABELS.nameplateOpen
/** Child/room chips keep their configured offset from the base font size,
    which the HUD font slider can move at runtime. */
const CHILD_FONT_DELTA = LABELS.fontSize - LABELS.childFontSize
const ROOM_FONT_DELTA = LABELS.roomFontSize - LABELS.fontSize

function estimateWidth(title: string, kids: number, fontScale = 1): number {
  return Math.min(
    CHIP_MAX_W,
    LABELS.chipBaseWidth + title.length * LABELS.chipCharWidth * fontScale +
      (kids > 0 ? LABELS.chipKidsWidth : 0),
  )
}

interface Placed {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Label {
  node: LaidOutNode
  /** Dot position on screen (room-morphed). */
  sx: number
  sy: number
  /** Label anchor on screen. */
  ax: number
  ay: number
  place: 'above' | 'below'
  /** 0..1 — ancestor-room openness chain for nested nodes; 1 for roots. */
  open: number
  /** This label is the nameplate of an open room. */
  room: boolean
  /** Morphed world position — drag seed so grabbed nodes don't pop. */
  mpos: [number, number]
  /** 0..1 — how far the camera has passed through this node's own room.
      Past 0.5 the deepest such node becomes the viewport-top header. */
  pass: number
}

/**
 * The node's only on-graph form: a dot (DotsCanvas) plus this title label,
 * at every zoom. Rendered imperatively on a rAF loop (like DotsCanvas) so
 * the camera moving never triggers a React re-render — labels are reconciled
 * against a cached DOM element per node each frame.
 *
 * Labels sit at the node's room-morph position, decluttered map-style
 * (greedy screen-space collision rejection, roots/nameplates outrank
 * children). Editing lives here via event delegation: click selects (opens
 * the detail panel), drag re-places — dropping onto another node re-parents
 * under it (the target lights up while hovering), dropping a child on empty
 * space promotes it to a root — double-click opens the editor, hover floats
 * a minimal content peek.
 */
export function NodeLabelLayer() {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = layerRef.current!

    // Imperative hover-preview bubble (title + body + tags), built once.
    const preview = document.createElement('div')
    preview.className = 'chip-preview'
    preview.style.display = 'none'
    const previewTitle = document.createElement('div')
    previewTitle.className = 'chip-preview-title'
    const previewBody = document.createElement('div')
    previewBody.className = 'chip-preview-body'
    const previewTags = document.createElement('div')
    previewTags.className = 'chip-preview-tags'
    preview.append(previewTitle, previewBody, previewTags)
    layer.append(preview)

    const elById = new Map<string, HTMLElement>()
    const posById = new Map<string, [number, number]>()
    const sigById = new Map<string, string>()
    let hoverId: string | null = null
    let previewFilled: string | null = null
    // Constellation gather animation, mirrors DotsCanvas: eases 0→1 while a
    // focus is active so relation labels fly in with their dots.
    let focusBlend = 0

    const drag = {
      pointerId: 0,
      nodeId: '',
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      pos: [0, 0] as [number, number],
      dragging: false,
      moved: false,
      /** Node under the pointer while dragging — releasing there re-parents. */
      targetId: null as string | null,
      /** Dragged node's subtree — never a valid drop target (cycle guard). */
      descendants: null as Set<string> | null,
    }
    let shakeId: string | null = null
    let shakeTimer: number | undefined

    const shake = (nodeId: string) => {
      window.clearTimeout(shakeTimer)
      shakeId = nodeId
      const el = elById.get(nodeId)
      el?.classList.add('shake')
      shakeTimer = window.setTimeout(() => {
        elById.get(nodeId)?.classList.remove('shake')
        if (shakeId === nodeId) shakeId = null
      }, 450)
    }

    const syncLabelContent = (el: HTMLElement, n: LaidOutNode, kids: number) => {
      const sig = `${n.locked ? 1 : 0}|${n.title}|${kids}|${n.placed ? 1 : 0}`
      if (sigById.get(n.id) === sig) return
      sigById.set(n.id, sig)
      el.replaceChildren()
      if (n.locked) el.append(document.createTextNode('🔒 '))
      el.append(document.createTextNode(n.title))
      if (kids > 0) {
        const s = document.createElement('span')
        s.className = 'chip-kids'
        s.textContent = `▸${kids}`
        el.append(s)
      }
      if (n.placed) {
        const s = document.createElement('span')
        s.className = 'chip-placed'
        s.textContent = '⌖'
        s.title = n.parentId ? 'Placed — pinned outside the parent orbit' : 'Placed — position pinned'
        el.append(s)
      }
    }

    const applyClass = (el: HTMLElement, cls: string) => {
      if (el.className !== cls) el.className = cls
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const { cam, zRooms, zCards, timeT, selectedId, labelFont } = useViewStore.getState()
      const world = useWorldStore.getState().world
      const focus = focusForSelection(world, selectedId)
      // Collision boxes scale with the runtime font size so bigger chips
      // don't overlap before the declutter sees them.
      const fontScale = labelFont / LABELS.fontSize
      const chipH = CHIP_H * fontScale
      if (!focus) focusBlend = 0
      else focusBlend = Math.min(1, focusBlend + (1 - focusBlend) * FOCUS.blendRate)
      const focusK = smoothstep(0, 1, focusBlend)
      // Focus mode overrides the zoom gate: the constellation's names stay
      // readable even zoomed all the way out.
      const band = focus ? Math.max(chipOpacity(cam.zoom, zRooms), focusK) : chipOpacity(cam.zoom, zRooms)
      const w = window.innerWidth
      const h = window.innerHeight

      if (band < 0.02) {
        for (const el of elById.values()) el.remove()
        elById.clear()
        posById.clear()
        sigById.clear()
        preview.style.display = 'none'
        return
      }

      // Candidates at room-morph positions, culled by where they DISPLAY —
      // subtrees hidden inside closed off-screen rooms are never visited.
      // In focus mode the spotlight set is the whole guest list: everyone
      // else's name leaves the screen.
      const morph = new Map<string, RoomMorph>()
      const ringTargets = focus
        ? focusRingTargets(
            world,
            focus,
            roomMorph(world, world.nodeById.get(focus.id)!, cam.zoom, cam, zCards, morph).pos,
            cam.zoom,
          )
        : null
      const dispOf = (id: string, m?: RoomMorph): [number, number] => {
        const base = (m ?? roomMorph(world, world.nodeById.get(id)!, cam.zoom, cam, zCards, morph)).pos
        const t = ringTargets?.get(id)
        if (!t) return base
        return [base[0] + (t[0] - base[0]) * focusK, base[1] + (t[1] - base[1]) * focusK]
      }
      const candidates: Label[] = []
      for (const { node: n, morph: m } of visibleNodes(world, cam, w, h, zCards, 60, morph)) {
        if (focus && !focus.nodeIds.has(n.id)) continue
        const isChild = !!n.parentId && !n.placed
        let open = 1
        if (isChild) {
          open = m.open
          // Focus members always keep their name — the selected node's
          // children gather on the inner ring even while their home room
          // is closed at this zoom.
          if (!focus && open < 0.05 && n.id !== selectedId) continue
          if (focus) open = 1
        }

        const pos = dispOf(n.id, m)
        const sx = w / 2 + (pos[0] - cam.x) * cam.zoom
        const sy = h / 2 + (pos[1] - cam.y) * cam.zoom
        const passing = m.pass > 0.5
        // No room nameplates in focus mode — every member's chip hugs its
        // displayed dot instead of riding a room boundary it has left.
        const room = !focus && !passing && m.roomOpen > NAMEPLATE_OPEN
        let place: 'above' | 'below' = 'above'
        let ay = sy - 12
        if (room) {
          // Nameplate rides the circle's top edge — using the UN-grown base
          // radius, so early pass-through (circle growing + fading) doesn't
          // drag the label upward with it.
          const kidCount = world.childrenByParent.get(n.id)?.length ?? 0
          ay = sy - roomRadius(kidCount, cam.zoom) * cam.zoom * roomRadiusEase(m.roomOpen) - 8
        } else if (isChild) {
          place = 'below'
          ay = sy + 12
        }
        candidates.push({ node: n, sx, sy, ax: sx, ay, place, open, room, mpos: pos, pass: m.pass })
      }
      // Relations whose home is off-screen still join the constellation:
      // they never pass through visibleNodes, so add them explicitly.
      // Children on the inner ring likewise (children hang their name
      // BELOW the dot, like everywhere else).
      if (focus) {
        const have = new Set(candidates.map((c) => c.node.id))
        for (const id of [...focus.ringIds, ...focus.childIds]) {
          if (have.has(id)) continue
          const n = world.nodeById.get(id)
          if (!n) continue
          const pos = dispOf(id)
          const sx = w / 2 + (pos[0] - cam.x) * cam.zoom
          const sy = h / 2 + (pos[1] - cam.y) * cam.zoom
          const isChild = focus.childIds.includes(id)
          candidates.push({
            node: n,
            sx,
            sy,
            ax: sx,
            ay: isChild ? sy + 12 : sy - 12,
            place: isChild ? 'below' : 'above',
            open: 1,
            room: false,
            mpos: pos,
            pass: 0,
          })
        }
      }
      // Deepest passed-through room owns the viewport: its label becomes the
      // header at the top edge; other passed ancestors' chips are context and
      // drop out of the label flow entirely. In focus mode the constellation
      // IS the view — no header docking, the selected node's name stays on
      // the center dot.
      let header: Label | undefined
      let headerDepth = -1
      if (!focus) {
        for (const l of candidates) {
          if (l.pass <= 0.5) continue
          const d = world.depthById.get(l.node.id) ?? 0
          if (d > headerDepth) {
            headerDepth = d
            header = l
          }
        }
      }
      if (header) {
        header.ax = w / 2
        header.ay = 34
        header.room = true
      }
      // Importance first: hub notes (most connections) win the label budget,
      // so an untouched map names its key figures before its footnotes.
      candidates.sort(
        (a, b) =>
          (world.degreeById.get(b.node.id) ?? 0) - (world.degreeById.get(a.node.id) ?? 0) ||
          (world.depthById.get(a.node.id) ?? 0) - (world.depthById.get(b.node.id) ?? 0) ||
          b.node.createdAt - a.node.createdAt ||
          a.node.id.localeCompare(b.node.id),
      )

      const box = (l: Label): Placed => {
        const kids = world.childrenByParent.get(l.node.id)?.length ?? 0
        const cw = estimateWidth(l.node.title, kids, fontScale)
        if (l.place === 'below') {
          return { x0: l.ax - cw / 2 - 2, y0: l.ay - 2, x1: l.ax + cw / 2 + 2, y1: l.ay + chipH + 2 }
        }
        return { x0: l.ax - cw / 2 - 2, y0: l.ay - chipH - 2, x1: l.ax + cw / 2 + 2, y1: l.ay + 2 }
      }

      // Collision declutter over a uniform grid: O(1) neighbor lookups
      // instead of scanning every placed label (matters past ~1k candidates).
      const CELL = LABELS.declutterCell
      const grid = new Map<number, Placed[]>()
      const cellKey = (cx: number, cy: number) => cx * 4096 + cy
      const eachCell = (r: Placed, fn: (k: number) => void) => {
        for (let cx = Math.floor(r.x0 / CELL); cx <= Math.floor(r.x1 / CELL); cx++)
          for (let cy = Math.floor(r.y0 / CELL); cy <= Math.floor(r.y1 / CELL); cy++)
            fn(cellKey(cx, cy))
      }
      const collides = (r: Placed): boolean => {
        let hit = false
        eachCell(r, (k) => {
          if (hit) return
          for (const p of grid.get(k) ?? []) {
            if (r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0) {
              hit = true
              return
            }
          }
        })
        return hit
      }
      const insert = (r: Placed) =>
        eachCell(r, (k) => {
          const arr = grid.get(k)
          if (arr) arr.push(r)
          else grid.set(k, [r])
        })

      const labels: Label[] = []
      if (header && header.node.id !== selectedId) {
        insert(box(header)) // reserve the top strip so nothing slides under it
        labels.push(header)
      }
      for (const l of candidates) {
        if (l.node.id === selectedId) continue // appended last, always visible
        if (l === header) continue
        // Passed-through ancestors are context, not labels — except in focus
        // mode, where every constellation member keeps its name at its ring
        // slot regardless of how deep the camera is.
        if (!focus && l.pass > 0.5) continue
        const rect = box(l)
        // Focus mode: every member of the spotlight set keeps its name —
        // the point of focusing is to see exactly who is connected.
        if (!focus && collides(rect)) continue
        insert(rect)
        labels.push(l)
        if (labels.length >= MAX_CHIPS) break
      }
      const sel = selectedId ? candidates.find((l) => l.node.id === selectedId) : undefined
      if (sel) labels.push(sel)

      // Reconcile DOM: update/create visible labels, remove stale ones.
      const seen = new Set<string>()
      for (const l of labels) {
        seen.add(l.node.id)
        let el = elById.get(l.node.id)
        if (!el) {
          el = document.createElement('div')
          el.dataset.id = l.node.id
          el.style.borderColor = l.node.color
          el.style.pointerEvents = 'auto'
          elById.set(l.node.id, el)
          layer.append(el)
        }
        const kids = world.childrenByParent.get(l.node.id)?.length ?? 0
        const tf = timeFactor(l.node.createdAt, timeT)
        const selected = l.node.id === selectedId
        const related = focus != null && !selected
        const cls = `chip${l.place === 'below' ? ' child' : ''}${l.room ? ' room' : ''}${l === header ? ' header' : ''}${selected ? ' selected' : ''}${related ? ' focus-label' : ''}${l.node.locked ? ' locked' : ''}${drag.dragging && drag.nodeId === l.node.id ? ' dragging' : ''}${drag.dragging && drag.targetId === l.node.id ? ' drop-target' : ''}${shakeId === l.node.id ? ' shake' : ''}`
        applyClass(el, cls)
        el.style.left = `${l.ax}px`
        el.style.top = `${l.ay}px`
        el.style.fontSize = `${l.room ? labelFont + ROOM_FONT_DELTA : l.place === 'below' ? labelFont - CHILD_FONT_DELTA : labelFont}px`
        el.style.opacity = String(band * (0.25 + 0.75 * tf) * l.open)
        syncLabelContent(el, l.node, kids)
        posById.set(l.node.id, l.mpos)
      }
      for (const [id, el] of elById) {
        if (!seen.has(id)) {
          el.remove()
          elById.delete(id)
          posById.delete(id)
          sigById.delete(id)
          if (hoverId === id) hoverId = null
        }
      }

      // Hover preview: track the hovered label's live position; fill text once.
      const showPreview = hoverId && hoverId !== selectedId && !drag.dragging
      if (showPreview && hoverId) {
        const n = world.nodeById.get(hoverId)
        const pos = posById.get(hoverId)
        if (n && pos) {
          if (previewFilled !== hoverId) {
            previewFilled = hoverId
            previewTitle.textContent = n.title
            previewBody.textContent = n.body
            previewTags.replaceChildren(
              ...n.tags.map((t) => {
                const s = document.createElement('span')
                s.className = 'tag'
                s.textContent = t
                return s
              }),
            )
          }
          const sx = w / 2 + (pos[0] - cam.x) * cam.zoom
          const sy = h / 2 + (pos[1] - cam.y) * cam.zoom
          preview.style.left = `${Math.min(sx + 18, w - 260)}px`
          preview.style.top = `${Math.max(8, Math.min(sy - 40, h - 240))}px`
          preview.style.borderColor = n.color
          preview.style.display = ''
        } else {
          preview.style.display = 'none'
        }
      } else {
        preview.style.display = 'none'
        previewFilled = null
      }
    }
    let raf = requestAnimationFrame(tick)

    // --- event delegation ---
    const chipOf = (t: EventTarget | null): HTMLElement | null => {
      if (!(t instanceof Element)) return null
      return t.closest('.chip')
    }

    const onPointerDown = (e: PointerEvent) => {
      const el = chipOf(e.target)
      if (!el) return
      e.stopPropagation()
      const id = el.dataset.id!
      const mpos = posById.get(id) ?? useWorldStore.getState().world.nodeById.get(id)?.position ?? [0, 0]
      drag.pointerId = e.pointerId
      drag.nodeId = id
      drag.startX = e.clientX
      drag.startY = e.clientY
      drag.lastX = e.clientX
      drag.lastY = e.clientY
      drag.pos = [mpos[0], mpos[1]]
      drag.dragging = false
      drag.moved = false
      drag.targetId = null
      drag.descendants = null
      el.setPointerCapture(e.pointerId)
    }

    /** Nearest droppable node to the pointer (screen space): not the dragged
        node, not its descendants, not locked — and only nodes the user can
        actually see (folded children huddling inside a closed room must not
        catch drops meant for the visible label on top of them). */
    const hitTestDropTarget = (clientX: number, clientY: number): string | null => {
      const { cam, zCards } = useViewStore.getState()
      const world = useWorldStore.getState().world
      const w = window.innerWidth
      const h = window.innerHeight
      const morph = new Map<string, RoomMorph>()
      let bestLabeled: string | null = null
      let bestLabeledD = DROP_RADIUS
      let bestAny: string | null = null
      let bestAnyD = DROP_RADIUS
      for (const n of world.nodes) {
        if (n.id === drag.nodeId || n.locked || drag.descendants?.has(n.id)) continue
        const m = roomMorph(world, n, cam.zoom, cam, zCards, morph)
        if (n.parentId && !n.placed && m.open < 0.3) continue // folded away — invisible
        const sx = w / 2 + (m.pos[0] - cam.x) * cam.zoom
        const sy = h / 2 + (m.pos[1] - cam.y) * cam.zoom
        if (sx < -DROP_RADIUS || sx > w + DROP_RADIUS || sy < -DROP_RADIUS || sy > h + DROP_RADIUS)
          continue
        const d = Math.hypot(sx - clientX, sy - clientY)
        if (d < bestAnyD) {
          bestAnyD = d
          bestAny = n.id
        }
        // When dots overlap, the node whose LABEL is on screen is the one the
        // user aimed at — it wins over an unlabeled neighbor at a tie-ish distance.
        if (elById.has(n.id) && d < bestLabeledD) {
          bestLabeledD = d
          bestLabeled = n.id
        }
      }
      return bestLabeled ?? bestAny
    }

    const onPointerMove = (e: PointerEvent) => {
      if (drag.pointerId !== e.pointerId) return
      if (!drag.dragging) {
        const dist = Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY)
        if (dist <= DRAG_THRESHOLD) return
        const node = useWorldStore.getState().world.nodeById.get(drag.nodeId)
        if (!node) {
          drag.pointerId = 0
          return
        }
        if (node.locked) {
          drag.pointerId = 0
          drag.dragging = false
          shake(drag.nodeId)
          useWorldStore.getState().toast('Note is locked — unlock it first')
          return
        }
        drag.dragging = true
        drag.moved = true
        // Snapshot the subtree once: descendants can never be drop targets.
        const world = useWorldStore.getState().world
        const desc = new Set<string>()
        const stack = [drag.nodeId]
        while (stack.length) {
          const cur = stack.pop()!
          for (const c of world.childrenByParent.get(cur) ?? []) {
            if (!desc.has(c.id)) {
              desc.add(c.id)
              stack.push(c.id)
            }
          }
        }
        drag.descendants = desc
      }
      const zoom = useViewStore.getState().cam.zoom
      drag.pos = [drag.pos[0] + (e.clientX - drag.lastX) / zoom, drag.pos[1] + (e.clientY - drag.lastY) / zoom]
      drag.lastX = e.clientX
      drag.lastY = e.clientY
      useWorldStore.getState().moveNode(drag.nodeId, drag.pos)
      drag.targetId = hitTestDropTarget(e.clientX, e.clientY)
    }

    const endDrag = (e: PointerEvent) => {
      if (drag.pointerId !== e.pointerId) return
      const nodeId = drag.nodeId
      const targetId = drag.moved ? drag.targetId : null
      drag.dragging = false
      drag.pointerId = 0
      drag.targetId = null
      drag.descendants = null
      if (targetId && targetId !== nodeId) {
        useWorldStore.getState().reparentNode(nodeId, targetId)
      } else if (drag.moved) {
        // Dropped on empty space: a child breaks its parent link and becomes
        // a free-placed root; a root just stays where it was dropped.
        const node = useWorldStore.getState().world.nodeById.get(nodeId)
        if (node?.parentId) useWorldStore.getState().promoteNode(nodeId)
      }
    }

    const onClick = (e: MouseEvent) => {
      const el = chipOf(e.target)
      if (!el) return
      e.stopPropagation()
      if (drag.moved) {
        drag.moved = false // suppress the click that follows a drag
        return
      }
      useViewStore.getState().select(el.dataset.id!)
    }

    const onDoubleClick = (e: MouseEvent) => {
      const el = chipOf(e.target)
      if (!el) return
      e.stopPropagation()
      const id = el.dataset.id!
      const node = useWorldStore.getState().world.nodeById.get(id)
      if (!node) return
      if (node.locked) {
        shake(id)
        useWorldStore.getState().toast('Note is locked — unlock it first')
        return
      }
      useViewStore.getState().select(id)
      useWorldStore.getState().setEditing(id)
    }

    const onOver = (e: PointerEvent) => {
      const el = chipOf(e.target)
      if (el) hoverId = el.dataset.id!
    }
    const onOut = (e: PointerEvent) => {
      const el = chipOf(e.target)
      if (el && chipOf(e.relatedTarget as EventTarget | null) !== el) {
        if (hoverId === el.dataset.id) hoverId = null
      }
    }

    layer.addEventListener('pointerdown', onPointerDown)
    layer.addEventListener('pointermove', onPointerMove)
    layer.addEventListener('pointerup', endDrag)
    layer.addEventListener('pointercancel', endDrag)
    layer.addEventListener('click', onClick)
    layer.addEventListener('dblclick', onDoubleClick)
    layer.addEventListener('pointerover', onOver)
    layer.addEventListener('pointerout', onOut)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(shakeTimer)
      layer.removeEventListener('pointerdown', onPointerDown)
      layer.removeEventListener('pointermove', onPointerMove)
      layer.removeEventListener('pointerup', endDrag)
      layer.removeEventListener('pointercancel', endDrag)
      layer.removeEventListener('click', onClick)
      layer.removeEventListener('dblclick', onDoubleClick)
      layer.removeEventListener('pointerover', onOver)
      layer.removeEventListener('pointerout', onOut)
      for (const el of elById.values()) el.remove()
      preview.remove()
    }
  }, [])

  return <div ref={layerRef} className="chip-layer" />
}
