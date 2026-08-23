import { describe, expect, it } from 'vitest'
import { PERSONAE } from './personae'
import { generateSanguoEdges, RELATIONS } from './relations'

const ids = new Set(PERSONAE.map((p) => p.id))

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

describe('sanguo relationships', () => {
  const edges = generateSanguoEdges()

  it('has a meaningful number of explicit relationships', () => {
    expect(RELATIONS.length).toBeGreaterThanOrEqual(50)
    expect(edges.length).toBeGreaterThanOrEqual(50)
  })

  it('references only known people and never self-links', () => {
    for (const r of RELATIONS) {
      expect(ids.has(r.from), `from ${r.from}`).toBe(true)
      expect(ids.has(r.to), `to ${r.to}`).toBe(true)
      expect(r.from).not.toBe(r.to)
    }
  })

  it('has no duplicate undirected pairs', () => {
    const seen = new Set<string>()
    for (const r of RELATIONS) {
      const key = pairKey(r.from, r.to)
      expect(seen.has(key), `duplicate ${key}`).toBe(false)
      seen.add(key)
    }
  })

  it('includes key Shu-Han relationships', () => {
    const shuPairs = [
      ['liu-bei', 'zhuge-liang'],
      ['liu-bei', 'guan-yu'],
      ['liu-bei', 'zhang-fei'],
      ['zhuge-liang', 'jiang-wei'],
      ['zhuge-liang', 'ma-su'],
      ['zhuge-liang', 'pang-tong'],
      ['zhuge-liang', 'fa-zheng'],
      ['guan-yu', 'zhang-fei'],
      ['liu-bei', 'zhao-yun'],
      ['liu-bei', 'ma-chao'],
    ]
    const keys = new Set(edges.map((e) => pairKey(e.from, e.to)))
    for (const [a, b] of shuPairs) {
      expect(keys.has(pairKey(a, b)), `missing ${a} <-> ${b}`).toBe(true)
    }
  })

  it('carries a human-readable label on every confirmed edge', () => {
    for (const e of edges) {
      expect(e.label).toBeTruthy()
    }
  })
})
