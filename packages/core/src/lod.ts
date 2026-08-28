import type { Camera, CavinNode, SelectionFocus, World } from './types'
import { smoothstep } from './layout'
import { layoutConfig } from './config'

const { lod: LOD, room: ROOM, labels: LABELS, focus: FOCUS } = layoutConfig/**
 * Zoom → band opacities. Node dots are the permanent node form: once they
 * fade in near the room band they stay fully visible at every deeper zoom.
 * Room/wing cluster labels still hand off to each other, and node labels
 * (chipOpacity) fade in once and never leave.
 */
export interface LodLevels {
  /** Room name labels (yield to node labels at close zoom). */
  rooms: number
  /** Wing name labels (dominate zoomed out). */
  wings: number
  /** Blurred cluster blobs on the dots canvas. */
  blobs: number
  /** Node dots — permanent once revealed. */
  dots: number
}

export function lodLevels(zoom: number, zRooms: number, zCards: number): LodLevels {
  return {
    rooms:
      smoothstep(zRooms * 0.8, zRooms, zoom) * (1 - smoothstep(zCards * 0.85, zCards * 1.1, zoom)),
    wings: 1 - smoothstep(zRooms * 0.9, zRooms * 1.4, zoom),
    blobs: 1 - smoothstep(zRooms * 1.2, zCards * 1.1, zoom),
    dots: smoothstep(zRooms * 0.6, zRooms * 1.1, zoom),
  }
}

export const MAX_CHIPS = LABELS.maxChips

/** Node-label band opacity: fades in with the room labels, never fades out. */
export function chipOpacity(zoom: number, zRooms: number): number {
  return smoothstep(zRooms * LOD.chipFadeStart, zRooms * LOD.chipFadeFull, zoom)
}

/**
 * Depth→zoom mapping: zoom becomes the granularity axis. Deeper tree levels
 * require proportionally more zoom to reveal, but the exponent saturates at
 * depth 6 so arbitrarily deep chains stay reachable within MAX_ZOOM — walking
 * into deeper levels happens spatially (rooms nested in rooms), not by
 * zooming forever.
 */
export function revealZoom(depth: number, zCards: number): number {
  return (
    zCards *
    LOD.revealBase *
    Math.pow(LOD.revealExponent, Math.min(LOD.revealSaturateDepth - 1, Math.max(0, depth - 1)))
  )
}

/** Continuous 0..1 gate for a child depth at the current zoom. */
export function zoomGate(depth: number, zoom: number, zCards: number): number {
  const lo = revealZoom(depth, zCards)
  return smoothstep(lo, lo * LOD.gateRamp, zoom)
}

/**
 * Focus falloff: only families near the viewport center open their rooms;
 * distant ones stay shut. Kept tight on purpose — when every visible family
 * opened at once the screen turned into bubble soup; opening IS focusing.
 */
const FOCUS_R = LOD.focusRadius // screen px radius of the "focused" region

export function focusFalloff(screenD2: number): number {
  const r = FOCUS_R
  const r2 = r * r
  if (screenD2 <= r2) return 1
  const outer = r * 1.6
  return 1 - smoothstep(r2, outer * outer, screenD2)
}

/* ------------------------------------------------------------------ */
/* Rooms: a node with children IS a room. Zooming toward it opens the  */
/* room — a soft boundary grows around it and its children travel from */
/* their tight cluster out onto a ring inside. Zooming away folds the  */
/* family back into the cluster. Recursive: a child with kids grows    */
/* its own room inside the parent's.                                   */
/* ------------------------------------------------------------------ */

export interface RoomMorph {
  /** Display position in world units (cluster pos → ring slot as the parent's room opens). */
  pos: [number, number]
  /** Product of ancestor room openness — visibility chain for nested nodes. */
  open: number
  /** How open this node's own room is (0 for childless nodes). */
  roomOpen: number
  /** Room radius in world units. Constant screen size while the room opens;
      once the camera passes THROUGH the room (pass > 0) it grows with zoom,
      spreading the children out to fill the view. */
  roomR: number
  /** 0..1 — how far the camera has passed through this room into its
      contents. The boundary fades out and the parent label becomes a
      top-of-viewport header (handled by the render layers). */
  pass: number
}

function lerp2(a: [number, number], b: [number, number], k: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
}

/** Room radius in world units; the screen radius stays constant (~110px+). */
export function roomRadius(childCount: number, zoom: number): number {
  return Math.max(ROOM.radiusMin, ROOM.radiusPerChild * Math.sqrt(childCount)) / zoom
}

/** Pass-through: past `revealZoom × PASS_START` the camera enters the room;
    by `× PASS_FULL` the boundary has faded and the contents own the view. */
const PASS_START = ROOM.passStart
const PASS_FULL = ROOM.passFull
/** Screen-radius growth while passing through (~3.2× → children fill the view). */
const PASS_GROW = ROOM.passGrow

/**
 * A child's slot inside its parent's room: on a ring at 62% of the room
 * radius with a small deterministic per-node jitter, so spread-out families
 * don't read as a mechanical compass rose.
 */
export function roomSlot(
  index: number,
  count: number,
  center: [number, number],
  roomR: number,
  jitter = 0,
): [number, number] {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2 + jitter
  const r = roomR * ROOM.ringFraction
  return [center[0] + Math.cos(angle) * r, center[1] + Math.sin(angle) * r]
}

/** Deterministic per-id jitter, ±30% of one ring-slot spacing. */
function slotJitter(id: string, count: number): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const slotAngle = (Math.PI * 2) / Math.max(1, count)
  return ((((h >>> 9) % 1000) / 1000) - 0.5) * slotAngle * 0.6
}

/** Eased drawn radius factor as a room opens (starts small, grows to full). */
export function roomRadiusEase(roomOpen: number): number {
  return ROOM.radiusEaseMin + (1 - ROOM.radiusEaseMin) * roomOpen
}

/**
 * Selection constellation: the confirmed neighbors of the focused node are
 * assigned slots on a ring around it (render-time only — world positions
 * never change). Neighbors are grouped by wing so related domains sit
 * adjacent on the ring, hubs first within a wing. The radius is constant in
 * SCREEN px (world radius = px / zoom), so the constellation stays the same
 * readable size at any zoom, and grows with the neighbor count so chips
 * don't overlap. The focused node's unplaced children form a tighter inner
 * ring (oldest first) — family sits close, relations on the outer ring.
 * Deterministic: same focus, same rings.
 */
export function focusRingTargets(
  world: World,
  focus: SelectionFocus,
  center: [number, number],
  zoom: number,
): Map<string, [number, number]> {
  // Neighbors grouped by their top-level group so related domains sit
  // adjacent on the ring, hubs first within a group. Group order follows
  // world.groups (first-encounter order — stable across re-derivations).
  const topOrder = new Map<string, number>()
  for (const g of world.groups) if (g.depth === 0) topOrder.set(g.id, topOrder.size)
  const ids = [...focus.ringIds].sort((a, b) => {
    const na = world.nodeById.get(a)!
    const nb = world.nodeById.get(b)!
    return (
      (topOrder.get(na.groupPath[0] ?? '') ?? 0) - (topOrder.get(nb.groupPath[0] ?? '') ?? 0) ||
      (world.degreeById.get(b) ?? 0) - (world.degreeById.get(a) ?? 0) ||
      a.localeCompare(b)
    )
  })
  const out = new Map<string, [number, number]>()
  const layOutRing = (list: string[], minRadiusPx: number) => {
    const n = list.length
    if (n === 0) return
    const r = Math.max(minRadiusPx, (n * FOCUS.ringPerNodePx) / (2 * Math.PI)) / zoom
    list.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      out.set(id, [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r])
    })
  }
  layOutRing(focus.childIds, FOCUS.innerRingPx)
  layOutRing(ids, FOCUS.ringRadiusPx)
  return out
}

/**
 * Zoom-driven room morph, in three stages per family:
 * 1. Closed: children huddle at their cluster position (parent orbit).
 * 2. Open (zoomGate): children travel onto the ring, boundary circle grows.
 * 3. Pass-through (zoom past revealZoom×PASS_START): the room radius grows
 *    WITH the camera instead of staying constant-screen-size, so the ring
 *    spreads out to fill the viewport and the boundary fades — the camera
 *    has "entered" the room and the children are now the contents.
 *
 * A child's visibility chain is the product of ancestor room openness, so
 * deep levels appear only once the whole chain above has opened — walking
 * into nested rooms. Placed nodes are exempt: they stay exactly where the
 * user dropped them.
 */
export function roomMorph(
  world: World,
  node: CavinNode,
  zoom: number,
  cam: Camera,
  zCards: number,
  cache: Map<string, RoomMorph>,
): RoomMorph {
  const hit = cache.get(node.id)
  if (hit) return hit

  let pos: [number, number]
  let open: number
  if (!node.parentId || node.state.placed) {
    pos = node.position
    open = 1
  } else {
    const parent = world.nodeById.get(node.parentId)
    if (!parent) {
      pos = node.position
      open = 1
    } else {
      const p = roomMorph(world, parent, zoom, cam, zCards, cache)
      const siblings = world.childrenByParent.get(node.parentId) ?? [node]
      const idx = Math.max(0, siblings.findIndex((s) => s.id === node.id))
      const slot = roomSlot(idx, siblings.length, p.pos, p.roomR, slotJitter(node.id, siblings.length))
      pos = lerp2(node.position, slot, p.roomOpen)
      open = p.open * p.roomOpen
    }
  }

  const depth = world.depthById.get(node.id) ?? 0
  const kidCount = world.childrenByParent.get(node.id)?.length ?? 0
  let roomOpen = 0
  let roomR = 0
  let pass = 0
  if (kidCount > 0) {
    const lo = revealZoom(depth + 1, zCards)
    const dx = pos[0] - cam.x
    const dy = pos[1] - cam.y
    const focus = focusFalloff((dx * dx + dy * dy) * zoom * zoom)
    roomOpen = zoomGate(depth + 1, zoom, zCards) * focus
    pass = smoothstep(lo * PASS_START, lo * PASS_FULL, zoom) * focus
    roomR = roomRadius(kidCount, zoom) * (1 + PASS_GROW * pass)
  }

  const res: RoomMorph = { pos, open, roomOpen, roomR, pass }
  cache.set(node.id, res)
  return res
}

/* ------------------------------------------------------------------ */
/* Visibility pruning: whole subtrees behind a closed, off-screen     */
/* ancestor room are skipped without recursing into them, so the      */
/* per-frame morph cost tracks what is on screen, not the world size. */
/* ------------------------------------------------------------------ */

export interface VisibleEntry {
  node: CavinNode
  morph: RoomMorph
  /** Screen-space dot position. */
  sx: number
  sy: number
}

/**
 * Viewport-reachable nodes with their room morphs, walked top-down. An
 * unplaced child always lives inside its parent's room extent (cluster or
 * ring), so when a parent is off-screen beyond that extent its whole
 * unplaced subtree is invisible and is not recursed into. Free-placed nodes
 * break that locality — they can sit anywhere — so they are always
 * evaluated on their own. `margin` is the caller's screen-px padding (dot
 * radius for the canvas, label size for the chip layer).
 */
export function visibleNodes(
  world: World,
  cam: Camera,
  w: number,
  h: number,
  zCards: number,
  margin: number,
  morph: Map<string, RoomMorph> = new Map(),
): VisibleEntry[] {
  const zoom = cam.zoom
  const out: VisibleEntry[] = []

  const walk = (node: CavinNode, include: boolean) => {
    const independent = !node.parentId || node.state.placed
    if (!include && !independent) return
    const m = roomMorph(world, node, zoom, cam, zCards, morph)
    const sx = w / 2 + (m.pos[0] - cam.x) * zoom
    const sy = h / 2 + (m.pos[1] - cam.y) * zoom
    // Children live at most roomR away from the node (ring when the room
    // opens, tight cluster when closed) — the subtree's screen extent.
    const kids = world.childrenByParent.get(node.id)
    const extent = kids?.length ? m.roomR * zoom : 0
    const reach = margin + extent
    const onScreen = sx >= -reach && sx <= w + reach && sy >= -reach && sy <= h + reach
    if (onScreen) out.push({ node, morph: m, sx, sy })
    // Descend only where children can still show: this node's own extent
    // touched the viewport (or an ancestor already did and this node too).
    for (const c of kids ?? []) walk(c, onScreen)
  }

  for (const n of world.nodes) {
    if (!n.parentId || n.state.placed) walk(n, true)
  }
  return out
}
