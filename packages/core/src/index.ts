/**
 * @cavin/core — the headless, schema-agnostic engine for progressive data
 * editing. DOM-free, React-free: the whole product minus pixels.
 *
 * Dependency direction: examples → @cavin/react → @cavin/core. Nothing here
 * imports from either.
 */
export * from './types'
export type { FieldDescriptor, SchemaAdapter } from './adapter'
export type { LayoutConfig, DeepPartial } from './config'
export { layoutConfig, mergeConfig } from './config'
export { hsla } from './colors'
export type { CavinEdge, WorldEdge } from './edges'
export { edgePairKey, indexEdgesByNode, mergeEdges, suggestEdges, validateEdgeRecords } from './edges'
export {
  groupPathKey,
  layoutNodes,
  deriveWorld,
  nodeColorIndex,
  focusForSelection,
  deletableSubtree,
  smoothstep,
  timeFactor,
} from './layout'
export {
  lodLevels,
  chipOpacity,
  revealZoom,
  roomRadius,
  roomRadiusEase,
  focusRingTargets,
  roomMorph,
  visibleNodes,
} from './lod'
export type { LodLevels, RoomMorph, VisibleEntry } from './lod'
export type { Command, MutationNotice, MutationResult } from './commands'
export { applyCommand, applyDragFrame } from './commands'
export type { CavinStorage, WorldSnapshot } from './storage'
export { createMemoryCavinStorage, validateRecords } from './storage'
export {
  labelOf,
  searchTextOf,
  tagsOf,
  bodyOf,
  fieldValueOf,
  timeFieldOf,
  timeOf,
  timeRangeOf,
} from './accessors'
export type { ConformanceFailure, ConformanceResult } from './testing'
export { runAdapterConformance } from './testing'
