import type { SchemaAdapter } from './adapter'
import type { CavinNode } from './types'

/**
 * Adapter conformance suite (`@cavin/core/testing`). Every host adapter
 * runs the same checks — write new adapters against `SchemaAdapter` so a
 * failure here surfaces before the canvas does.
 */
export interface ConformanceFailure {
  check: string
  detail: string
}

export interface ConformanceResult {
  ok: boolean
  failures: ConformanceFailure[]
}

export function runAdapterConformance<TAttr>(
  adapter: SchemaAdapter<TAttr>,
  samples: { valid: unknown[]; malformed: unknown[] },
): ConformanceResult {
  const failures: ConformanceFailure[] = []
  const fail = (check: string, detail: string) => failures.push({ check, detail })

  // validate decodes the valid samples without throwing and drops the
  // malformed ones (fail-safe contract).
  for (const raw of samples.valid) {
    let node: CavinNode<TAttr> | null = null
    try {
      node = adapter.validate(raw)
    } catch (err) {
      fail('validate', `threw on a valid sample: ${String(err)}`)
      continue
    }
    if (!node) {
      fail('validate', 'returned null for a valid sample')
      continue
    }
    if (typeof node.id !== 'string' || !Array.isArray(node.groupPath)) {
      fail('validate', 'produced a node without id/groupPath')
      continue
    }
    // groupOf never throws and returns strings.
    try {
      const path = adapter.groupOf(node)
      if (!Array.isArray(path) || path.some((s) => typeof s !== 'string')) {
        fail('groupOf', 'did not return a string[] for a valid node')
      }
    } catch (err) {
      fail('groupOf', `threw: ${String(err)}`)
    }
    // labelOf returns a non-empty string.
    try {
      const label = adapter.labelOf(node)
      if (typeof label !== 'string' || label.length === 0) {
        fail('labelOf', 'returned an empty/non-string label')
      }
    } catch (err) {
      fail('labelOf', `threw: ${String(err)}`)
    }
    // Field keys exist on the attributes payload.
    for (const f of adapter.fields) {
      if (!(f.key in (node.attributes as Record<string, unknown>))) {
        fail('fields', `key "${String(f.key)}" missing on a validated node's attributes`)
      }
    }
  }
  for (const raw of samples.malformed) {
    let node: CavinNode<TAttr> | null = null
    try {
      node = adapter.validate(raw)
    } catch (err) {
      fail('validate', `threw on a malformed sample (must drop, not throw): ${String(err)}`)
      continue
    }
    if (node) fail('validate', 'accepted a malformed sample')
  }

  // createDefault produces attributes carrying every field key, and its
  // layout vector (if any) is all-zero — a freshly created item has no
  // meaningful content, so it must never attract machine-suggested
  // connections.
  try {
    const attrs = adapter.createDefault({ groupPath: [] })
    for (const f of adapter.fields) {
      if (f.kind === 'readonly') continue
      if (!(f.key in (attrs as Record<string, unknown>))) {
        fail('createDefault', `missing field key "${String(f.key)}"`)
      }
    }
    const vector = adapter.layoutVectorOf?.({
      id: '',
      position: [0, 0],
      groupPath: [],
      attributes: attrs,
      state: {},
    })
    if (vector && vector.some((v) => v !== 0)) {
      fail(
        'createDefault',
        'produces a non-zero layout vector — a fresh node would attract machine-suggested connections',
      )
    }
  } catch (err) {
    fail('createDefault', `threw: ${String(err)}`)
  }

  return { ok: failures.length === 0, failures }
}
