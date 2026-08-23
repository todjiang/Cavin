import { deriveWorld, layoutNodes } from '../data/layout'
import type { LaidOutNode, World } from '../data/layout'
import type { CavinEdge } from '../data/edges'
import { generateNodes } from '../../examples/machine-learning/generate'
import { buildLegacySanguoNodes } from '../../examples/sanguo/preview/seed'
import { generateSanguoEdges } from '../../examples/sanguo/src/relations'

/**
 * Demo dataset registry — the demo layer's catalogue of loadable worlds.
 * `build` returns the persisted flat shape (nodes + confirmed edges); the
 * world store wraps it with `deriveWorld` and lets its persistence
 * subscription save the result, exactly like a demo reset.
 *
 * The machine-learning palace is generated procedurally (fixed seed) at
 * call time; sanguo is a curated static dataset with deterministic
 * placement. Both builders are pure — no DOM, no storage.
 */
export interface DemoDataset {
  id: string
  /** HUD switcher label. */
  label: string
  build(): { nodes: LaidOutNode[]; edges: CavinEdge[] }
}

export const DEMO_DATASETS: DemoDataset[] = [
  {
    id: 'memory-palace',
    label: 'memory palace',
    build: () => ({ nodes: layoutNodes(generateNodes()), edges: [] }),
  },
  {
    id: 'sanguo',
    label: '三国 sanguo',
    // buildLegacySanguoNodes returns the legacy flat persisted shape —
    // structurally a LaidOutNode minus the color/hue it never had; the
    // derive path fills presentation fields from the wing index.
    build: () => ({
      nodes: buildLegacySanguoNodes() as LaidOutNode[],
      edges: generateSanguoEdges(),
    }),
  },
]

export const DEFAULT_DATASET = 'memory-palace'

export function datasetById(id: string | undefined): DemoDataset {
  return DEMO_DATASETS.find((d) => d.id === id) ?? DEMO_DATASETS[0]
}

/** Build a fresh world from a dataset (first boot, dataset switch, reset). */
export function buildDatasetWorld(id: string | undefined): { world: World; edges: CavinEdge[] } {
  const dataset = datasetById(id)
  const { nodes, edges } = dataset.build()
  return { world: deriveWorld(nodes, undefined, edges), edges }
}
