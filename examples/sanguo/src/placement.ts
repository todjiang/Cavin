/**
 * Deterministic placement for the Sanguo preview.
 *
 * The legacy seed scattered rooms at random angles around each wing center
 * and Gaussian-jittered members inside a room, so nothing about a person's
 * position meant anything. This module replaces that with a legible scheme:
 *
 * - Camps (wings) stay evenly on a large circle, 魏 at the top.
 * - Role rooms occupy FIXED slots: 君主 sits at the camp center, the other
 *   six roles on a ring at fixed angles — every camp has the same "face".
 * - Inside a room, members are sorted by peak year and laid out on a grid,
 *   earliest first, reading left→right then top→bottom: contemporaries are
 *   neighbours and relation arcs between them stay short.
 *
 * Pure and randomness-free: same input → same positions.
 */
import type { Camp, Role, SanguoNode } from './types'
import { CAMPS, ROLES } from './types'

/** Top-level camps sit on a circle of this radius (matches framework default). */
export const WING_CIRCLE_RADIUS = 1500
/** Non-君主 role rooms orbit the camp center at this radius. */
export const ROLE_RING_RADIUS = 360
/** Grid pitch inside a room. */
export const ERA_COL_PITCH = 64
export const ERA_ROW_PITCH = 64
/** Fallback ordering year when a person has no dated timeSpan. */
const DEFAULT_PEAK = 208

export function wingCenterOf(camp: Camp): [number, number] {
  const i = CAMPS.indexOf(camp)
  const a = (i / CAMPS.length) * Math.PI * 2 - Math.PI / 2
  return [Math.cos(a) * WING_CIRCLE_RADIUS, Math.sin(a) * WING_CIRCLE_RADIUS]
}

/** 君主 anchors the camp; other roles take fixed slots on the ring. */
export function roomCenterOf(camp: Camp, role: Role): [number, number] {
  const [wx, wy] = wingCenterOf(camp)
  const ri = ROLES.indexOf(role)
  if (ri === 0) return [wx, wy]
  const a = ((ri - 1) / (ROLES.length - 1)) * Math.PI * 2 - Math.PI / 2
  return [wx + Math.cos(a) * ROLE_RING_RADIUS, wy + Math.sin(a) * ROLE_RING_RADIUS]
}

function orderingYear(n: SanguoNode): number {
  const { start, end, peak } = n.attributes.timeSpan
  if (peak != null) return peak
  if (start != null && end != null) return (start + end) / 2
  return start ?? end ?? DEFAULT_PEAK
}

/**
 * Positions for root nodes (children keep their relOffset hug, applied by
 * the caller). Roots in the same room fill a grid centered on the room's
 * slot, ordered by ascending peak year with id as the tiebreak.
 */
export function computePlacement(nodes: SanguoNode[]): Map<string, [number, number]> {
  const byRoom = new Map<string, SanguoNode[]>()
  for (const n of nodes) {
    if (n.parentId) continue
    const key = `${n.groupPath[0]}/${n.groupPath[1]}`
    const list = byRoom.get(key)
    if (list) list.push(n)
    else byRoom.set(key, [n])
  }

  const out = new Map<string, [number, number]>()
  for (const [key, members] of byRoom) {
    const [camp, role] = key.split('/') as [Camp, Role]
    const [cx, cy] = roomCenterOf(camp, role)
    members.sort((a, b) => orderingYear(a) - orderingYear(b) || (a.id < b.id ? -1 : 1))
    const cols = Math.ceil(Math.sqrt(members.length))
    const rows = Math.ceil(members.length / cols)
    members.forEach((m, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      out.set(m.id, [
        cx + (col - (cols - 1) / 2) * ERA_COL_PITCH,
        cy + (row - (rows - 1) / 2) * ERA_ROW_PITCH,
      ])
    })
  }
  return out
}
