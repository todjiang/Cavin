import { PERSONAE } from './personae'
import type {
  PersonSeed,
  Role,
  SanguoAttrs,
  SanguoNode,
  Stats,
  TimeSpan,
} from './types'
import { ROLES, TIME_DOMAIN } from './types'

/** Deterministic PRNG so the example looks identical after every reset. */
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

function hashString(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return h >>> 0
}

const DEFAULT_STATS: Record<Role, Stats> = {
  君主: [72, 65, 76, 82, 85],
  宗室: [68, 72, 60, 54, 70],
  武将: [78, 84, 56, 42, 68],
  谋士: [68, 38, 90, 78, 74],
  文臣: [38, 28, 78, 88, 74],
  女性: [24, 20, 72, 58, 84],
  方技: [20, 16, 88, 58, 74],
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function statsFor(seed: PersonSeed): Stats {
  if (seed.stats) return seed.stats
  const base = DEFAULT_STATS[seed.role]
  const rand = hashRand(hashString(seed.id))
  return base.map((v) => Math.round(clamp(v + (rand() - 0.5) * 16, 10, 99))) as Stats
}

function timeSpanOf(seed: PersonSeed): TimeSpan {
  const peak =
    seed.peakYear ??
    (seed.birthYear !== undefined && seed.deathYear !== undefined
      ? Math.round((seed.birthYear + seed.deathYear) / 2)
      : seed.birthYear ?? seed.deathYear)
  return {
    start: seed.birthYear,
    end: seed.deathYear,
    peak,
  }
}

function bioOf(seed: PersonSeed): string {
  const courtesy = seed.courtesy ? `，字${seed.courtesy}` : ''
  const years =
    seed.birthYear !== undefined || seed.deathYear !== undefined
      ? ` 生卒：${seed.birthYear ?? '?'}–${seed.deathYear ?? '?'}。`
      : ''
  const tags = seed.tags.length > 0 ? ` 标签：${seed.tags.join('、')}。` : ''
  return `${seed.name}${courtesy}，${seed.camp}${seed.role}。${seed.summary}${years}${tags}`
}

/**
 * Five stats + lifespan + era + deterministic jitter + camp one-hot.
 *
 * The camp one-hot deliberately lowers cross-camp cosine similarity so the
 * machine-suggested edge layer does not draw meaningless dashed lines
 * between states. Same-camp similarity is untouched (suggested edges only
 * connect different camps), so the embedding still works for layout.
 */
export function embeddingOf(stats: Stats, time: TimeSpan, id: string, camp: PersonSeed['camp']): number[] {
  const [command, might, intellect, politics, charm] = stats
  const lifespan =
    time.start !== undefined && time.end !== undefined
      ? clamp((time.end - time.start) / 80, 0, 1)
      : 0.5
  const era = time.peak !== undefined ? clamp((time.peak - 155) / (280 - 155), 0, 1) : 0.5
  const jitter = hashRand(hashString(id))() * 0.12 - 0.06
  const oneHot: Record<PersonSeed['camp'], number[]> = {
    魏: [1, 0, 0, 0],
    蜀: [0, 1, 0, 0],
    吴: [0, 0, 1, 0],
    群雄: [0, 0, 0, 1],
  }
  return [
    command / 100,
    might / 100,
    intellect / 100,
    politics / 100,
    charm / 100,
    lifespan,
    era,
    clamp(0.5 + jitter, 0, 1),
    ...oneHot[camp],
  ]
}

function attrsOf(seed: PersonSeed): SanguoAttrs {
  const stats = statsFor(seed)
  const timeSpan = timeSpanOf(seed)
  const tags = Array.from(
    new Set([seed.camp, seed.role, ...seed.tags, ...(seed.approximate ? ['年份存疑'] : [])]),
  )
  return {
    name: seed.name,
    courtesy: seed.courtesy,
    camp: seed.camp,
    role: seed.role,
    birthYear: seed.birthYear,
    deathYear: seed.deathYear,
    peakYear: timeSpan.peak,
    approximate: seed.approximate,
    summary: seed.summary,
    bio: bioOf(seed),
    tags,
    stats: embeddingOf(stats, timeSpan, seed.id, seed.camp),
    timeSpan,
    relationToParent: seed.relation,
  }
}

/**
 * Build raw Sanguo nodes for the framework. Positions are left at [0,0]:
 * `@cavin/core` initial layout assigns the scatter/spread positions.
 */
export function generateSanguoNodes(): SanguoNode[] {
  const byId = new Map<string, PersonSeed>()
  for (const p of PERSONAE) {
    if (byId.has(p.id)) throw new Error(`[sanguo] duplicate person id: ${p.id}`)
    byId.set(p.id, p)
  }

  const childrenByParent = new Map<string, string[]>()
  for (const p of PERSONAE) {
    if (!p.parentId) continue
    if (!byId.has(p.parentId)) {
      throw new Error(`[sanguo] ${p.id} references missing parent ${p.parentId}`)
    }
    const list = childrenByParent.get(p.parentId) ?? []
    list.push(p.id)
    childrenByParent.set(p.parentId, list)
  }

  // Topological DFS: parents always precede children, and cycles are rejected.
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const ordered: string[] = []
  const visit = (id: string) => {
    if (visited.has(id)) return
    if (visiting.has(id)) throw new Error(`[sanguo] parent cycle at ${id}`)
    visiting.add(id)
    const seed = byId.get(id)!
    if (seed.parentId && !visited.has(seed.parentId)) visit(seed.parentId)
    visiting.delete(id)
    visited.add(id)
    ordered.push(id)
  }
  for (const p of PERSONAE) visit(p.id)

  return ordered.map((id) => {
    const seed = byId.get(id)!
    return {
      id: seed.id,
      parentId: seed.parentId,
      groupPath: [seed.camp, seed.role],
      position: [0, 0],
      attributes: attrsOf(seed),
      state: {},
    }
  })
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Visibility factor for a person across the year axis. */
export function timeFactorForYear(span: TimeSpan, year: number, rampYears = 3): number {
  const fadeIn =
    span.start === undefined ? 1 : smoothstep(span.start, span.start + rampYears, year)
  const fadeOut =
    span.end === undefined ? 1 : 1 - smoothstep(span.end - rampYears, span.end, year)
  return fadeIn * fadeOut
}

export function formatYear(year: number): string {
  return `${year} 年`
}

export function timeDomainOf(_nodes: SanguoNode[]): [number, number] {
  return TIME_DOMAIN
}

export const SANGUO_ROLE_COUNT = ROLES.length
