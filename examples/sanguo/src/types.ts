/**
 * Sanguo demo data model.
 *
 * This example owns these types. The framework (@cavin/core) must never
 * import them; it only sees the generic `CavinNode<TAttr>` shape produced by
 * `generateSanguoNodes()` and described by `sanguoAdapter`.
 */

export type Camp = '魏' | '蜀' | '吴' | '群雄'

export type Role =
  | '君主'
  | '宗室'
  | '武将'
  | '谋士'
  | '文臣'
  | '女性'
  | '方技'

export const CAMPS: Camp[] = ['魏', '蜀', '吴', '群雄']

export const ROLES: Role[] = ['君主', '宗室', '武将', '谋士', '文臣', '女性', '方技']

/** Five classical Koei-style stats, 0–100. */
export type Stats = [number, number, number, number, number]

/** Curated source record. `parentId` is a family/succession link. */
export interface PersonSeed {
  id: string
  name: string
  courtesy?: string
  camp: Camp
  role: Role
  /** Gregorian year. Omit when unknown; set `approximate` for estimates. */
  birthYear?: number
  deathYear?: number
  /** The year this person was at the height of their influence. */
  peakYear?: number
  approximate?: boolean
  summary: string
  tags: string[]
  stats?: Stats
  parentId?: string
  /** How `parentId` should be read: family or political succession. */
  relation?: string
}

export interface TimeSpan {
  start?: number
  end?: number
  peak?: number
}

/** Host-defined attributes. The framework only sees this through the adapter. */
export interface SanguoAttrs {
  name: string
  courtesy?: string
  camp: Camp
  role: Role
  birthYear?: number
  deathYear?: number
  peakYear?: number
  approximate?: boolean
  summary: string
  bio: string
  tags: string[]
  /** 8-dim vector derived from the five stats + lifespan + era. */
  stats: number[]
  timeSpan: TimeSpan
  relationToParent?: string
}

/** Raw node shape handed to the framework as `initialNodes`. */
export interface SanguoNode {
  id: string
  parentId?: string
  /** Coarse → fine. Replaces the legacy wingId/roomId pair. */
  groupPath: [Camp, Role]
  /** Assigned by @cavin/core initial layout. */
  position: [number, number]
  attributes: SanguoAttrs
  state: {
    locked?: boolean
    confirmed?: boolean
    placed?: boolean
    relOffset?: [number, number]
  }
}

export const TIME_DOMAIN: [number, number] = [184, 280]

export interface TimelineEvent {
  year: number
  label: string
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
  { year: 184, label: '黄巾起义' },
  { year: 189, label: '董卓入京' },
  { year: 200, label: '官渡之战' },
  { year: 208, label: '赤壁之战' },
  { year: 219, label: '襄樊之战' },
  { year: 222, label: '夷陵之战' },
  { year: 228, label: '街亭之战' },
  { year: 234, label: '五丈原' },
  { year: 249, label: '高平陵之变' },
  { year: 263, label: '蜀汉灭亡' },
  { year: 280, label: '三家归晋' },
]
