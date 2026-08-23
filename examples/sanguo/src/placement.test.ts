import { describe, expect, it } from 'vitest'
import { generateSanguoNodes } from './generate'
import {
  computePlacement,
  roomCenterOf,
  wingCenterOf,
  ERA_COL_PITCH,
  ERA_ROW_PITCH,
  ROLE_RING_RADIUS,
} from './placement'
import type { SanguoNode } from './types'
import { CAMPS, ROLES } from './types'

describe('sanguo placement', () => {
  const nodes = generateSanguoNodes()
  const roots = nodes.filter((n) => !n.parentId)
  const placement = computePlacement(nodes)

  it('places every root node and no child', () => {
    expect(placement.size).toBe(roots.length)
    for (const n of nodes) {
      expect(placement.has(n.id), n.id).toBe(!n.parentId)
    }
  })

  it('is deterministic', () => {
    expect(computePlacement(nodes)).toEqual(placement)
  })

  it('anchors the 君主 room at the camp center', () => {
    for (const camp of CAMPS) {
      expect(roomCenterOf(camp, '君主')).toEqual(wingCenterOf(camp))
    }
  })

  it('gives every camp the same role slots', () => {
    for (const role of ROLES) {
      const [x0, y0] = roomCenterOf(CAMPS[0], role)
      const [wx0, wy0] = wingCenterOf(CAMPS[0])
      for (const camp of CAMPS.slice(1)) {
        const [x, y] = roomCenterOf(camp, role)
        const [wx, wy] = wingCenterOf(camp)
        expect(x - wx, `${camp}/${role}`).toBeCloseTo(x0 - wx0)
        expect(y - wy, `${camp}/${role}`).toBeCloseTo(y0 - wy0)
      }
    }
    // Non-君主 roles sit on the ring.
    const [x, y] = roomCenterOf('魏', '武将')
    const [wx, wy] = wingCenterOf('魏')
    expect(Math.hypot(x - wx, y - wy)).toBeCloseTo(ROLE_RING_RADIUS)
  })

  it('orders same-room members by ascending peak year along the grid', () => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const byRoom = new Map<string, SanguoNode[]>()
    for (const n of roots) {
      const key = n.groupPath.join('/')
      const list = byRoom.get(key)
      if (list) list.push(n)
      else byRoom.set(key, [n])
    }
    const yearOf = (n: SanguoNode) => {
      const { start, end, peak } = n.attributes.timeSpan
      return peak ?? (start != null && end != null ? (start + end) / 2 : (start ?? end ?? 208))
    }
    for (const [key, members] of byRoom) {
      // Placement order = ascending year: recover it via row-major position sort.
      const sorted = [...members].sort((a, b) => {
        const [xa, ya] = placement.get(a.id)!
        const [xb, yb] = placement.get(b.id)!
        return ya - yb || xa - xb
      })
      for (let i = 1; i < sorted.length; i++) {
        expect(
          yearOf(byId.get(sorted[i].id)!),
          `${key}: ${sorted[i - 1].id} before ${sorted[i].id}`,
        ).toBeGreaterThanOrEqual(yearOf(byId.get(sorted[i - 1].id)!))
      }
    }
  })

  it('keeps same-room members on a non-overlapping grid', () => {
    const byRoom = new Map<string, [number, number][]>()
    for (const n of roots) {
      const key = n.groupPath.join('/')
      const list = byRoom.get(key) ?? []
      list.push(placement.get(n.id)!)
      byRoom.set(key, list)
    }
    for (const [key, positions] of byRoom) {
      expect(new Set(positions.map((p) => p.join(','))).size, key).toBe(positions.length)
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const d = Math.hypot(
            positions[i][0] - positions[j][0],
            positions[i][1] - positions[j][1],
          )
          expect(d, key).toBeGreaterThanOrEqual(Math.min(ERA_COL_PITCH, ERA_ROW_PITCH))
        }
      }
    }
  })
})
