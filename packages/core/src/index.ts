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
export { subtree, subtreeFrom, deepestDepth, leafGroups, nearestGroup, groupsByDepth, orderParentsFirst } from './tree'
export type { SubtreeOptions } from './tree'
export { groupPathKey, nodeColorIndex } from './clusters'
export { smoothstep, timeFactor } from './math'
export { focusForSelection } from './selection'
export { layoutNodes, deriveWorld } from './layout'
export {
  lodLevels,
  clusterLevels,
  chipOpacity,
  revealZoom,
  roomRadius,
  roomRadiusEase,
  focusRingTargets,
  roomMorph,
  visibleNodes,
} from './lod'
export type { LodLevels, RoomMorph, VisibleEntry } from './lod'
export type { Viewport, Scene, SceneEntry, SceneParams } from './scene'
export { deriveScene } from './scene'
export type { Command, MutationError, MutationNotice, MutationResult } from './commands'
export { applyCommand } from './commands'
export type {
  OntologyClass,
  OntologyRelation,
  OntologySchema,
  RelationValidationError,
  RelationValidationResult,
} from './ontology'
export { ontologyRelation, validateRelation, worldToJsonLd } from './ontology'
export type { CavinStorage, WorldSnapshot } from './storage'
export { createMemoryCavinStorage, decodeSnapshot, validateRecords } from './storage'
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
