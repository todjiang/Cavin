/**
 * Temporary browser seed for the CURRENT single-package Cavin app.
 *
 * The current app still persists the legacy flat node shape
 * (`cavin-world-v3`). This shim converts the isolated Sanguo nodes into that
 * shape, assigns the deterministic slot/era placement from src/placement.ts,
 * and writes localStorage.
 * When `@cavin/core` + `@cavin/react` exist, this file disappears: the
 * example will pass `initialNodes` directly to `<CavinCanvas/>`.
 */
import { generateSanguoNodes } from '../src/generate'
import { computePlacement } from '../src/placement'
import { generateSanguoEdges } from '../src/relations'
import { CAMPS, ROLES } from '../src/types'

const STORAGE_KEY = 'cavin-world-v3'
const DAY = 24 * 60 * 60 * 1000

interface LegacyNode {
  id: string
  parentId?: string
  wingId: string
  wingName: string
  roomId: string
  roomName: string
  title: string
  body: string
  tags: string[]
  embedding: number[]
  createdAt: number
  position: [number, number]
  relOffset?: [number, number]
  groupPath?: string[]
}

function hashRand(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export function buildLegacySanguoNodes(): LegacyNode[] {
  const raw = generateSanguoNodes()
  const campIndex = new Map(CAMPS.map((c, i) => [c, i]))
  const roleIndex = new Map(ROLES.map((r, i) => [r, i]))
  const placement = computePlacement(raw)
  const rand = hashRand(0x5a69)
  const gauss = () => (rand() + rand() + rand() - 1.5) * 2

  const now = Date.now()
  const byId = new Map<string, LegacyNode>()
  const legacy: LegacyNode[] = []
  for (const n of raw) {
    const wi = campIndex.get(n.groupPath[0])!
    const ri = roleIndex.get(n.groupPath[1])!
    const wingId = `wing-${wi}`
    const roomId = `${wingId}-room-${ri}`
    const peak = n.attributes.timeSpan.peak ?? 208
    const era = clamp(peak, 184, 280)
    const createdAt = now - Math.round(((280 - era) / 96) * 730) * DAY

    let position: [number, number]
    let relOffset: [number, number] | undefined
    if (n.parentId && byId.has(n.parentId)) {
      const parent = byId.get(n.parentId)!
      relOffset = [gauss() * 18, gauss() * 18]
      position = [parent.position[0] + relOffset[0], parent.position[1] + relOffset[1]]
    } else {
      position = placement.get(n.id)!
    }

    const legacyNode: LegacyNode = {
      id: n.id,
      parentId: n.parentId,
      wingId,
      wingName: n.groupPath[0],
      roomId,
      roomName: n.groupPath[1],
      title: n.attributes.name,
      body: n.attributes.bio,
      tags: n.attributes.tags,
      embedding: n.attributes.stats,
      createdAt,
      position,
      relOffset,
      groupPath: [n.groupPath[0], n.groupPath[1]],
    }
    byId.set(n.id, legacyNode)
    legacy.push(legacyNode)
  }
  return legacy
}

export interface SeedResult {
  nodes: LegacyNode[]
  camps: number
  roles: number
}

export function seedSanguoPreview(storageKey = STORAGE_KEY): SeedResult {
  const nodes = buildLegacySanguoNodes()
  const camps = new Set(nodes.map((n) => n.wingName)).size
  const roles = new Set(nodes.map((n) => n.roomName)).size
  window.localStorage.setItem(storageKey, JSON.stringify({ nodes, edges: generateSanguoEdges() }))
  return { nodes, camps, roles }
}
