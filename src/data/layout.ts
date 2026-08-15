import type { KnowledgeNode } from '../demo/generate'
import { generateNodes, TIME_MIN, TIME_MAX } from '../demo/generate'
import { layoutConfig } from '../config'

const { layout: LAYOUT } = layoutConfig

export interface LaidOutNode extends KnowledgeNode {
  /** 2D world position (world units = px at zoom 1). */
  position: [number, number]
  /** CSS color derived from the wing dimension. */
  color: string
  /** Wing hue, for canvas gradients that need an alpha channel. */
  hue: number
  /** Child's home position relative to its parent; the "unplaced" child anchor. */
  relOffset?: [number, number]
  /** Locked: cannot be moved, edited, or deleted until unlocked. */
  locked?: boolean
  /** Human-confirmed: future machine imports must not overwrite this note.
      Set/cleared together with `locked` — locking IS confirming. */
  confirmed?: boolean
  /** Free-placed: user-dropped position, exempt from the cluster/orbit home. */
  placed?: boolean
  /** Internal: group path derived by the adapter during P2 generalization.
      Not used by the current UI, but preserved on the node for migration. */
  groupPath?: string[]
}

export interface RoomCluster {
  id: string
  name: string
  wingId: string
  wingName: string
  centroid: [number, number]
  radius: number
  count: number
  color: string
  hue: number
}

export interface WingCluster {
  id: string
  name: string
  centroid: [number, number]
  radius: number
  count: number
  color: string
  hue: number
}

export interface World {
  nodes: LaidOutNode[]
  rooms: RoomCluster[]
  wings: WingCluster[]
  nodeById: Map<string, LaidOutNode>
  roomById: Map<string, RoomCluster>
  wingById: Map<string, WingCluster>
  /** Parent id → its children, sorted oldest-first. Key present only for parents. */
  childrenByParent: Map<string, LaidOutNode[]>
  /** Nesting depth: 0 = room-level root, 1 = child, 2 = grandchild, … */
  depthById: Map<string, number>
}

const WING_CIRCLE_RADIUS = LAYOUT.topLevelRadius
const ROOM_SPREAD_MIN = LAYOUT.groupSpreadMin
const ROOM_SPREAD_MAX = LAYOUT.groupSpreadMax
const DRAWER_SIGMA = LAYOUT.itemSigma
const CHILD_ORBIT_SIGMA = LAYOUT.childOrbitSigma

function wingHue(wingIndex: number): number {
  return (wingIndex * LAYOUT.hueStep + LAYOUT.hueOffset) % 360
}

export function hsl(hue: number): string {
  return `hsl(${hue}, ${LAYOUT.colorSaturation}%, ${LAYOUT.colorLightness}%)`
}

export function hsla(hue: number, alpha: number): string {
  return `hsla(${hue}, ${LAYOUT.colorSaturation}%, ${LAYOUT.colorLightness}%, ${alpha})`
}

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a))
}

/** Deterministic pseudo-random from an integer seed (layout-only, independent of data seed). */
function hashRand(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Wings sorted numerically (wing-0..wing-N) so hues stay stable across re-derivations. */
function sortedWingIds(nodes: { wingId: string }[]): string[] {
  return [...new Set(nodes.map((n) => n.wingId))].sort(
    (a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]),
  )
}

/**
 * Initial layout: wings evenly on a large circle, rooms clustered around their
 * wing center, drawers Gaussian-jittered around the room centroid with radius
 * scaled by embedding similarity. Pure — used only for the seeded first boot
 * (and demo reset); afterwards positions live in the store and persist.
 */
/** Layout nodes for the demo. Uses the demo adapter to infer groupPath,
    but keeps wing/room fields materialized for compatibility with the
    existing UI during P2 generalization. */
export function layoutNodes(raw: KnowledgeNode[], adapter: SchemaAdapter<KnowledgeNode> = DEMO_ADAPTER): LaidOutNode[] {
  const rand = hashRand(0x1a7)
  const wingIds = sortedWingIds(raw)

  // Wings evenly on a large circle.
  const wingCenters = new Map<string, [number, number]>()
  wingIds.forEach((wid, i) => {
    const a = (i / wingIds.length) * Math.PI * 2 - Math.PI / 2
    wingCenters.set(wid, [Math.cos(a) * WING_CIRCLE_RADIUS, Math.sin(a) * WING_CIRCLE_RADIUS])
  })

  // Rooms clustered around their wing center.
  const roomIds = [...new Set(raw.map((n) => n.roomId))]
  const roomCenters = new Map<string, [number, number]>()
  roomIds.forEach((rid) => {
    const wingId = rid.split('-room-')[0]
    const wc = wingCenters.get(wingId)!
    const spread = ROOM_SPREAD_MIN + rand() * (ROOM_SPREAD_MAX - ROOM_SPREAD_MIN)
    const a = rand() * Math.PI * 2
    roomCenters.set(rid, [wc[0] + Math.cos(a) * spread, wc[1] + Math.sin(a) * spread])
  })

  // Room base embedding = mean of root member embeddings (they were generated clustered).
  const roots = raw.filter((n) => !n.parentId)
  const roomBase = new Map<string, number[]>()
  for (const rid of roomIds) {
    const members = roots.filter((n) => n.roomId === rid)
    const mean = new Array(8).fill(0)
    for (const m of members) for (let i = 0; i < 8; i++) mean[i] += m.embedding[i] / members.length
    roomBase.set(rid, mean)
  }

  // Parents always precede their children in the generated array, so a child
  // can anchor to its already-placed parent as we walk.
  const laidById = new Map<string, LaidOutNode>()
  const gauss = () => (rand() + rand() + rand() - 1.5) * 2 // approx normal in [-3, 3]
  const nodes: LaidOutNode[] = raw.map((n) => {
    const wingIndex = wingIds.indexOf(n.wingId)
    const groupPath = adapter.groupOf({ attributes: n })
    const hue = hueForGroup(groupPath, adapter)
    const base: LaidOutNode = {
      id: n.id,
      parentId: n.parentId,
      position: [0, 0], // filled below
      groupPath,
      attributes: n,
      state: {},
    }

    let laid: LaidOutNode
    if (n.parentId && laidById.has(n.parentId)) {
      // Child: tight radial jitter around its parent, remembered as relOffset.
      const parent = laidById.get(n.parentId)!
      const relOffset: [number, number] = [gauss() * CHILD_ORBIT_SIGMA, gauss() * CHILD_ORBIT_SIGMA]
      laid = {
        ...base,
        position: [parent.position[0] + relOffset[0], parent.position[1] + relOffset[1]],
        state: { relOffset },
      }
    } else {
      // Root: jitter around the room centroid, radius scaled by embedding similarity.
      const rc = roomCenters.get(n.roomId)!
      const rb = roomBase.get(n.roomId)!
      const sim = dot(n.embedding, rb) / (norm(n.embedding) * norm(rb) || 1) // cosine-ish
      const radiusScale = 0.7 + 0.6 * Math.max(0, Math.min(1, sim))
      laid = {
        ...base,
        position: [
          rc[0] + gauss() * DRAWER_SIGMA * radiusScale,
          rc[1] + gauss() * DRAWER_SIGMA * radiusScale,
        ],
      }
    }
    laidById.set(n.id, laid)
    return laid
  })
  return nodes
}

/**
 * Derive the renderable world (cluster aggregates, lookup maps, colors, tree
 * indexes) from a node array. Runs on boot and after every mutation.
 *
 * Rules:
 * - Rooms and wings are anchored by ROOT notes only (`!parentId`): children
 *   never warp room geometry, but do count.
 * - Children with a missing parent (defensive — cascades should prevent it)
 *   are promoted to roots.
 * - Unplaced children are normalized to `parent.position + relOffset`, so a
 *   child's home follows its parent automatically.
 * - Free-placed roots keep their position and are excluded from their room's
 *   centroid/radius.
 * - Rooms with no members left disappear; a room whose roots all went
 *   free-placed keeps its previous centroid (or the mean of placed roots).
 */
export function deriveWorld(rawNodes: LaidOutNode[], prev?: World): World {
  const wingIds = sortedWingIds(rawNodes)
  const hueOf = (wid: string) => wingHue(wingIds.indexOf(wid))

  // Fresh copies with (re)computed color/hue — callers may pass stored objects.
  const nodes: LaidOutNode[] = rawNodes.map((n) => {
    const hue = hueOf(n.wingId)
    return { ...n, hue, color: hsl(hue) }
  })
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  // Tree indexes; orphan children are promoted to roots defensively.
  const childrenByParent = new Map<string, LaidOutNode[]>()
  const depthById = new Map<string, number>()
  for (const n of nodes) {
    if (n.parentId && !nodeById.has(n.parentId)) n.parentId = undefined
    if (!n.parentId) continue
    const list = childrenByParent.get(n.parentId) ?? []
    list.push(n)
    childrenByParent.set(n.parentId, list)
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  }
  const depthOf = (n: LaidOutNode): number => {
    const cached = depthById.get(n.id)
    if (cached !== undefined) return cached
    // Chain depth is tiny (≤3); walk up, guarding against cycles.
    let d = 0
    let cur: LaidOutNode | undefined = n
    const seen = new Set<string>()
    while (cur?.parentId && nodeById.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id)
      d++
      cur = nodeById.get(cur.parentId)
    }
    depthById.set(n.id, d)
    return d
  }
  for (const n of nodes) depthOf(n)

  // Unplaced children ride their parent's position (parents precede children
  // in every array we build, so the parent's position is already final).
  for (const n of nodes) {
    if (n.parentId && !n.placed && n.relOffset) {
      const parent = nodeById.get(n.parentId)!
      n.position = [parent.position[0] + n.relOffset[0], parent.position[1] + n.relOffset[1]]
    }
  }

  const roomIds = [...new Set(nodes.map((n) => n.roomId))]
  const rooms: RoomCluster[] = []
  for (const rid of roomIds) {
    const members = nodes.filter((n) => n.roomId === rid)
    const roomRoots = members.filter((m) => !m.parentId)
    const gridMembers = roomRoots.filter((m) => !m.placed)
    const first = members[0]

    // Centroid: mean of grid-bound roots; fallbacks keep the room stable
    // when every root has been dragged out.
    const anchor = gridMembers.length > 0 ? gridMembers : roomRoots.length > 0 ? roomRoots : members
    let c: [number, number] = [0, 0]
    for (const m of anchor) {
      c[0] += m.position[0] / anchor.length
      c[1] += m.position[1] / anchor.length
    }
    if (gridMembers.length === 0 && prev?.roomById.has(rid)) {
      c = prev.roomById.get(rid)!.centroid
    }

    let radius = 60
    for (const m of gridMembers) {
      const d = Math.hypot(m.position[0] - c[0], m.position[1] - c[1])
      if (d > radius) radius = d
    }

    rooms.push({
      id: rid,
      name: first.roomName,
      wingId: first.wingId,
      wingName: first.wingName,
      centroid: c,
      radius,
      count: members.length,
      color: first.color,
      hue: first.hue,
    })
  }

  const wings: WingCluster[] = wingIds.map((wid, i) => {
    const memberRooms = rooms.filter((r) => r.wingId === wid)
    const c: [number, number] = [0, 0]
    for (const r of memberRooms) {
      c[0] += r.centroid[0] / memberRooms.length
      c[1] += r.centroid[1] / memberRooms.length
    }
    let radius = 0
    for (const r of memberRooms) {
      const d = Math.hypot(r.centroid[0] - c[0], r.centroid[1] - c[1]) + r.radius
      if (d > radius) radius = d
    }
    const hue = wingHue(i)
    return {
      id: wid,
      name: memberRooms[0]?.wingName ?? wid,
      centroid: c,
      radius,
      count: memberRooms.reduce((s, r) => s + r.count, 0),
      color: hsl(hue),
      hue,
    }
  })

  return {
    nodes,
    rooms,
    wings,
    nodeById,
    roomById: new Map(rooms.map((r) => [r.id, r])),
    wingById: new Map(wings.map((w) => [w.id, w])),
    childrenByParent,
    depthById,
  }
}

/**
 * The set a delete would actually remove: the node plus its descendants,
 * except that a locked node shields itself and its whole branch. The node
 * itself is assumed unlocked (the store guards that before calling).
 */
export function deletableSubtree(world: World, rootId: string): Set<string> {
  const out = new Set<string>()
  const walk = (id: string, isRoot: boolean) => {
    const node = world.nodeById.get(id)
    if (!node) return
    if (!isRoot && node.locked) return // locked branch shields itself
    out.add(id)
    for (const child of world.childrenByParent.get(id) ?? []) walk(child.id, false)
  }
  walk(rootId, true)
  return out
}

/** Ids of a node's movable subtree: itself + descendants, minus locked branches. */
export function movableSubtree(world: World, rootId: string): Set<string> {
  const out = new Set<string>()
  const walk = (id: string, isRoot: boolean) => {
    const node = world.nodeById.get(id)
    if (!node) return
    if (!isRoot && node.locked) return
    out.add(id)
    for (const child of world.childrenByParent.get(id) ?? []) walk(child.id, false)
  }
  walk(rootId, true)
  return out
}

/* ------------------------------------------------------------------ */
/* Pure tree mutations — the refinement operations, extracted from the */
/* store so they can be tested without a DOM. Each returns a new node  */
/* array; the store feeds it through deriveWorld + persist.            */
/* ------------------------------------------------------------------ */

export type TreeMutationError =
  | 'missing'
  | 'self'
  | 'cycle'
  | 'noop'
  | 'locked-node'
  | 'locked-target'

export interface TreeMutationOutcome {
  ok: boolean
  error?: TreeMutationError
  nodes?: LaidOutNode[]
  /** 'rejoined' = dropped back on the current parent and returned to orbit. */
  kind?: 'reparented' | 'rejoined' | 'promoted'
}

function childrenIndex(nodes: LaidOutNode[]): Map<string, LaidOutNode[]> {
  const map = new Map<string, LaidOutNode[]>()
  for (const n of nodes) {
    if (!n.parentId) continue
    const list = map.get(n.parentId) ?? []
    list.push(n)
    map.set(n.parentId, list)
  }
  return map
}

/**
 * Re-parent `id` under `newParentId`: the node re-joins the new parent's
 * orbit at a fresh relOffset, and the whole movable subtree crosses into the
 * new parent's wing/room so colors, breadcrumbs and room membership stay
 * consistent. Refuses cycles and locked nodes/targets. Dropping a
 * free-placed child back onto its current parent re-joins the orbit.
 */
export function reparentNodes(
  nodes: LaidOutNode[],
  id: string,
  newParentId: string,
  rand: () => number = Math.random,
): TreeMutationOutcome {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const node = byId.get(id)
  const parent = byId.get(newParentId)
  if (!node || !parent) return { ok: false, error: 'missing' }
  if (id === newParentId) return { ok: false, error: 'self' }
  if (node.locked) return { ok: false, error: 'locked-node' }
  if (parent.locked) return { ok: false, error: 'locked-target' }

  if (node.parentId === newParentId) {
    if (!node.placed) return { ok: false, error: 'noop' }
    return {
      ok: true,
      kind: 'rejoined',
      nodes: nodes.map((n) => (n.id === id ? { ...n, placed: false } : n)),
    }
  }

  // Cycle guard: the new parent must not be the node or its descendant.
  for (
    let p: LaidOutNode | undefined = parent;
    p;
    p = p.parentId ? byId.get(p.parentId) : undefined
  ) {
    if (p.id === id) return { ok: false, error: 'cycle' }
  }

  const kids = childrenIndex(nodes)
  const subtree = new Set<string>()
  const walk = (cur: string, isRoot: boolean) => {
    const n = byId.get(cur)
    if (!n) return
    if (!isRoot && n.locked) return
    subtree.add(cur)
    for (const c of kids.get(cur) ?? []) walk(c.id, false)
  }
  walk(id, true)

  const angle = rand() * Math.PI * 2
  const radius = LAYOUT.childSpawnRadiusMin + rand() * LAYOUT.childSpawnRadiusSpread
  const relOffset: [number, number] = [Math.cos(angle) * radius, Math.sin(angle) * radius]
  const ctx = {
    wingId: parent.wingId,
    wingName: parent.wingName,
    roomId: parent.roomId,
    roomName: parent.roomName,
  }
  return {
    ok: true,
    kind: 'reparented',
    nodes: nodes.map((n) => {
      if (!subtree.has(n.id)) return n
      if (n.id !== id) return { ...n, ...ctx }
      return {
        ...n,
        ...ctx,
        parentId: newParentId,
        relOffset,
        position: [
          parent.position[0] + relOffset[0],
          parent.position[1] + relOffset[1],
        ] as [number, number],
        placed: false,
      }
    }),
  }
}

/**
 * Promote a child to a root: drops the parent link and pins the node where
 * it sits (free-placed), keeping its wing/room context. The children of the
 * node stay attached to it — only the upward link breaks.
 */
export function promoteToRootNodes(nodes: LaidOutNode[], id: string): TreeMutationOutcome {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const node = byId.get(id)
  if (!node) return { ok: false, error: 'missing' }
  if (node.locked) return { ok: false, error: 'locked-node' }
  if (!node.parentId) return { ok: false, error: 'noop' }
  return {
    ok: true,
    kind: 'promoted',
    nodes: nodes.map((n) =>
      n.id === id ? { ...n, parentId: undefined, relOffset: undefined, placed: true } : n,
    ),
  }
}

/** First boot / demo reset: generate the seeded palace and lay it out. */
export function buildInitialWorld(): World {
  return deriveWorld(layoutNodes(generateNodes()))
}

/** smoothstep(a, b, x) */
export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Time-dimension factor in [0,1]: at timeT=0 everything is bright; as the slider
 * moves right, nodes older than the cutoff dim/shrink away (older = dimmer).
 */
export function timeFactor(createdAt: number, timeT: number): number {
  const cutoff = TIME_MIN + timeT * (TIME_MAX - TIME_MIN)
  const ramp = 0.12 * (TIME_MAX - TIME_MIN)
  return smoothstep(cutoff, cutoff + ramp, createdAt)
}
