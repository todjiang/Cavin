// Deterministic seeded mock data: 6 wings x 6 rooms x 15 drawers (~540 roots),
// plus nested children — any note may have children, recursively (max depth 3).
// A mulberry32 PRNG keeps the palace stable across reloads.

export interface KnowledgeNode {
  id: string
  wingId: string
  wingName: string
  roomId: string
  roomName: string
  /** Absent = root note in a room grid; set = child of another note. */
  parentId?: string
  title: string
  body: string
  tags: string[]
  /** Synthetic 8-dim "embedding", clustered around the room's base vector. */
  embedding: number[]
  createdAt: number
}

export const WING_COUNT = 6
export const ROOMS_PER_WING = 6
export const DRAWERS_PER_ROOM = 15

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WINGS: { name: string; rooms: string[] }[] = [
  { name: 'Machine Learning', rooms: ['Optimizers', 'Transformers', 'Embeddings', 'Evaluation', 'Distillation', 'Inference'] },
  { name: 'Design', rooms: ['Typography', 'Color Theory', 'Layout', 'Motion', 'Design Systems', 'Prototyping'] },
  { name: 'Cooking', rooms: ['Fermentation', 'Knife Skills', 'Sauces', 'Baking', 'Sourcing', 'Plating'] },
  { name: 'History', rooms: ['Rome', 'Ming Dynasty', 'Cold War', 'Silk Road', 'Revolutions', 'Historiography'] },
  { name: 'Music', rooms: ['Harmony', 'Rhythm', 'Synthesis', 'Jazz Theory', 'Orchestration', 'Production'] },
  { name: 'Systems', rooms: ['Databases', 'Networking', 'Compilers', 'Distributed', 'Operating Systems', 'Observability'] },
]

const TITLE_A = ['On', 'Notes on', 'Rethinking', 'A Field Guide to', 'The Limits of', 'Patterns in', 'Against', 'Toward', 'Inside', 'Beyond', 'Essays on', 'Reflections on']
const TITLE_B = ['Practical', 'Quiet', 'Latent', 'Emergent', 'Forgotten', 'Modular', 'Adaptive', 'Fragile', 'Recursive', 'Honest', 'Unseen', 'Concrete']
const TITLE_C = ['Tradeoffs', 'Abstractions', 'Intuitions', 'Heuristics', 'Failures', 'Structures', 'Rhythms', 'Boundaries', 'Signals', 'Craft', 'Patterns', 'Principles']

const SENTENCES = [
  'The core idea only becomes obvious after the third failed attempt.',
  'Most of the literature quietly assumes the happy path.',
  'This turns out to be a special case of a much older observation.',
  'Benchmarks here flatter the method; the failure modes are the interesting part.',
  'A small change in framing collapses half of the apparent complexity.',
  'The trick is knowing which invariants you are allowed to break.',
  'Beginners over-index on tools; experts over-index on taste.',
  'What looks like noise at this scale is signal at the next.',
  'The historical accident became load-bearing and nobody noticed.',
  'Write the invariant down before you optimize anything.',
  'Every abstraction leaks exactly where the tutorial said it would not.',
  'The cheap approximation wins nine times out of ten.',
]

const TAG_POOL = [
  'draft', 'evergreen', 'reference', 'idea', 'question', 'summary',
  'experiment', 'quote', 'todo', 'revisit', 'canonical', 'skeptical',
]

const DAY = 24 * 60 * 60 * 1000
// Start of today, local — keeps the seeded palace feeling fresh on reset.
const NOW = new Date()
NOW.setHours(0, 0, 0, 0)
const NOW_MS = NOW.getTime()
const SPAN_DAYS = 730

function makeEmbedding(rand: () => number, base: number[] | null): number[] {
  const dim = 8
  const v: number[] = []
  for (let i = 0; i < dim; i++) {
    const noise = (rand() + rand() + rand() - 1.5) * 0.35
    v.push(base ? base[i] + noise : rand() * 2 - 1)
  }
  return v
}

function makeNode(
  rand: () => number,
  id: string,
  ctx: { wingId: string; wingName: string; roomId: string; roomName: string },
  baseEmbedding: number[],
  createdAt: number,
  parentId?: string,
): KnowledgeNode {
  const title = `${TITLE_A[Math.floor(rand() * TITLE_A.length)]} ${TITLE_B[Math.floor(rand() * TITLE_B.length)]} ${TITLE_C[Math.floor(rand() * TITLE_C.length)]}`
  const bodyLen = 2 + Math.floor(rand() * 2)
  const body = Array.from({ length: bodyLen }, () => SENTENCES[Math.floor(rand() * SENTENCES.length)]).join(' ')
  const tagCount = 1 + Math.floor(rand() * 3)
  const tags = Array.from(
    new Set(Array.from({ length: tagCount }, () => TAG_POOL[Math.floor(rand() * TAG_POOL.length)])),
  )
  return {
    id,
    ...ctx,
    parentId,
    title,
    body,
    tags,
    embedding: makeEmbedding(rand, baseEmbedding),
    createdAt,
  }
}

// Nesting: each child independently rolls ~22% odds of having its own
// children, capped at MAX_DEPTH so a few deep chains exist without exploding.
// Unlimited-depth support lives in the renderer; the generator just seeds a
// natural spread of shallow-to-deep families.
const CHILD_CHANCE = 0.22
const CHILD_MIN = 1
const CHILD_MAX = 3
const MAX_DEPTH = 8

// Showcase deep chains: deterministic sample data that exercises the
// unlimited-depth renderer — four themed 7-level hierarchies attached to
// specific drawers, so the demo always has "rooms within rooms" to walk
// into all the way down.
const DEEP_CHAINS: { drawerId: string; levels: string[] }[] = [
  {
    drawerId: 'wing-1-room-0-drawer-2', // Design / Typography
    levels: [
      'Typeface Classification',
      'Humanist Letterforms',
      'Stem Contrast',
      'X-Height Rules',
      'Counter Shape',
      'Optical Sizing',
      'Display vs Body',
    ],
  },
  {
    drawerId: 'wing-2-room-0-drawer-7', // Cooking / Fermentation
    levels: [
      'The Starter',
      'Feeding Schedule',
      'Hydration Ratio',
      'Activity Windows',
      'Peak Timing',
      'Cold Retard',
      'Oven Spring',
    ],
  },
  {
    drawerId: 'wing-3-room-1-drawer-4', // History / Ming Dynasty
    levels: [
      'Silver Imports',
      'Maritime Trade Networks',
      'Port Governance',
      'Smuggling Rings',
      'Corruption Cases',
      'Reform Attempts',
      'Collapse Sequence',
    ],
  },
  {
    drawerId: 'wing-5-room-0-drawer-9', // Systems / Distributed
    levels: [
      'Consensus Protocols',
      'Paxos Basics',
      'Prepared Phase',
      'Promise Rules',
      'Leader Election',
      'Failure Recovery',
      'View Changes',
    ],
  },
]

function makeChildren(
  rand: () => number,
  parent: KnowledgeNode,
  depth: number,
  out: KnowledgeNode[],
): void {
  if (depth >= MAX_DEPTH) return
  if (rand() >= CHILD_CHANCE) return
  const count = CHILD_MIN + Math.floor(rand() * (CHILD_MAX - CHILD_MIN + 1))
  const ctx = {
    wingId: parent.wingId,
    wingName: parent.wingName,
    roomId: parent.roomId,
    roomName: parent.roomName,
  }
  for (let i = 0; i < count; i++) {
    // Children are always newer than their parent, spread over a short window
    // so they don't all clamp to NOW.
    const createdAt = Math.min(NOW_MS, parent.createdAt + (1 + Math.floor(rand() * 40)) * DAY)
    const child = makeNode(rand, `${parent.id}-child-${depth}-${i}`, ctx, parent.embedding, createdAt, parent.id)
    out.push(child)
    makeChildren(rand, child, depth + 1, out)
  }
}

export function generateNodes(): KnowledgeNode[] {
  const rand = mulberry32(0x5eed)
  const nodes: KnowledgeNode[] = []

  WINGS.forEach((wing, wi) => {
    const wingId = `wing-${wi}`
    wing.rooms.forEach((roomName, ri) => {
      const roomId = `${wingId}-room-${ri}`
      const roomBase = makeEmbedding(rand, null)
      for (let di = 0; di < DRAWERS_PER_ROOM; di++) {
        const createdAt = NOW_MS - Math.floor(rand() * SPAN_DAYS) * DAY - Math.floor(rand() * DAY)
        const node = makeNode(
          rand,
          `${roomId}-drawer-${di}`,
          { wingId, wingName: wing.name, roomId, roomName },
          roomBase,
          createdAt,
        )
        nodes.push(node)
        // Showcase roots get a guaranteed deep chain instead of random nesting.
        const showcase = DEEP_CHAINS.find((c) => c.drawerId === node.id)
        if (showcase) {
          let parent = node
          let prevCreated = node.createdAt
          showcase.levels.forEach((title, li) => {
            const childCreated = Math.min(NOW_MS, prevCreated + (1 + li) * DAY)
            const child = makeNode(
              rand,
              `${parent.id}-deep-${li}`,
              { wingId, wingName: wing.name, roomId, roomName },
              parent.embedding,
              childCreated,
              parent.id,
            )
            child.title = title
            nodes.push(child)
            parent = child
            prevCreated = childCreated
          })
        } else {
          makeChildren(rand, node, 0, nodes)
        }
      }
    })
  })

  return nodes
}

export const TIME_MIN = NOW_MS - SPAN_DAYS * DAY - DAY
export const TIME_MAX = NOW_MS
