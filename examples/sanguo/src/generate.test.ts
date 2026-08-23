import { describe, expect, it } from 'vitest'
import { generateSanguoNodes, timeFactorForYear } from './generate'
import { CAMPS, ROLES } from './types'
import type { SanguoNode } from './types'

function depthOf(nodes: SanguoNode[], id: string): number {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let d = 0
  let cur = byId.get(id)
  const seen = new Set<string>()
  while (cur?.parentId && !seen.has(cur.id)) {
    seen.add(cur.id)
    d++
    cur = byId.get(cur.parentId)
  }
  return d
}

describe('sanguo demo dataset', () => {
  const nodes = generateSanguoNodes()
  const byId = new Map(nodes.map((n) => [n.id, n]))

  it('generates a meaningful number of people', () => {
    expect(nodes.length).toBeGreaterThanOrEqual(240)
    expect(nodes.length).toBeLessThanOrEqual(400)
  })

  it('has unique ids and no orphan parents', () => {
    expect(byId.size).toBe(nodes.length)
    for (const n of nodes) {
      if (n.parentId) expect(byId.has(n.parentId), `${n.id} -> ${n.parentId}`).toBe(true)
    }
  })

  it('parents always precede their children', () => {
    const indexById = new Map(nodes.map((n, i) => [n.id, i]))
    for (const n of nodes) {
      if (!n.parentId) continue
      expect(indexById.get(n.parentId)!, `${n.parentId} before ${n.id}`).toBeLessThan(
        indexById.get(n.id)!,
      )
    }
  })

  it('covers every camp and every role', () => {
    for (const camp of CAMPS) {
      expect(nodes.some((n) => n.groupPath[0] === camp), `camp ${camp}`).toBe(true)
    }
    for (const role of ROLES) {
      expect(nodes.some((n) => n.groupPath[1] === role), `role ${role}`).toBe(true)
    }
  })

  it('contains at least one deep succession/family chain', () => {
    const maxDepth = Math.max(...nodes.map((n) => depthOf(nodes, n.id)))
    expect(maxDepth).toBeGreaterThanOrEqual(5)
  })

  it('keeps every group path valid and two levels deep', () => {
    for (const n of nodes) {
      expect(n.groupPath).toHaveLength(2)
      expect(CAMPS).toContain(n.groupPath[0])
      expect(ROLES).toContain(n.groupPath[1])
    }
  })

  it('keeps time spans internally consistent', () => {
    for (const n of nodes) {
      const { start, end, peak } = n.attributes.timeSpan
      if (start !== undefined && end !== undefined) {
        expect(start, n.id).toBeLessThanOrEqual(end)
      }
      if (peak !== undefined && start !== undefined && end !== undefined) {
        expect(peak, n.id).toBeGreaterThanOrEqual(start)
        expect(peak, n.id).toBeLessThanOrEqual(end)
      }
    }
  })

  it('produces finite 12-dim embeddings in [0,1] with a camp one-hot', () => {
    const campDims: Record<string, number[]> = {
      魏: [1, 0, 0, 0],
      蜀: [0, 1, 0, 0],
      吴: [0, 0, 1, 0],
      群雄: [0, 0, 0, 1],
    }
    for (const n of nodes) {
      expect(n.attributes.stats).toHaveLength(12)
      for (const v of n.attributes.stats) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
      expect(n.attributes.stats.slice(8)).toEqual(campDims[n.groupPath[0]])
    }
  })

  it('is deterministic', () => {
    expect(generateSanguoNodes()).toEqual(nodes)
  })

  it('fades a person in and out around their lifespan', () => {
    const span = { start: 180, end: 220, peak: 200 }
    expect(timeFactorForYear(span, 170)).toBe(0)
    expect(timeFactorForYear(span, 200)).toBe(1)
    expect(timeFactorForYear(span, 230)).toBe(0)
    expect(timeFactorForYear(span, 181)).toBeGreaterThan(0)
    expect(timeFactorForYear(span, 219)).toBeGreaterThan(0)
  })
})
