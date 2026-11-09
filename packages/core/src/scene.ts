import type { Camera, CavinNode, SelectionFocus, World } from './types'
import type { LayoutConfig } from './config'
import { layoutConfig } from './config'
import { smoothstep } from './math'
import { focusForSelection } from './selection'
import { focusRingTargets, roomMorph, visibleNodes, type RoomMorph } from './lod'

/**
 * The Scene is the pure projection layer: one derive call turns
 * (world, camera, viewport, zCards, selectedId, focusBlend) into every
 * screen-space entity the render layers paint. The projection formula
 * `w/2 + (x − cam.x) · zoom` lives ONLY here — painters receive ready
 * sx/sy and never touch the camera math themselves.
 */
export interface Viewport {
  /** Canvas width in CSS px. */
  w: number
  /** Canvas height in CSS px. */
  h: number
}

export interface SceneEntry<TAttr = unknown> {
  node: CavinNode<TAttr>
  morph: RoomMorph
  /** Screen-space dot position. */
  sx: number
  sy: number
  /** True when the entry was pulled into the projection by the selection
      constellation even though it sits off-screen — painters must not
      cull these again, but may want to clamp or fade them. */
  offscreen?: boolean
}

export interface Scene<TAttr = unknown> {
  world: World<TAttr>
  cam: Camera
  viewport: Viewport
  /**
   * Shared per-frame room-morph cache. CONTRACT: valid only for the exact
   * (world, cam, zCards) this scene was derived from. A frame holder hands
   * out one scene per tick; render layers may read `morphs` for extra
   * lookups within the same tick but must never retain references across
   * ticks — the next derive replaces the Map.
   */
  morphs: Map<string, RoomMorph>
  /** Viewport-reachable entries, in stable paint order. */
  entries: SceneEntry<TAttr>[]
  focus: SelectionFocus | null
  /** Eased 0..1 focus blend for this frame (0 when there is no focus). */
  focusK: number
  /** Selection-constellation slot targets in world coords; empty without focus. */
  ringTargets: Map<string, [number, number]>
  /** Project a world point to screen px with this scene's camera+viewport. */
  project: (x: number, y: number) => [number, number]
}

export interface SceneParams<TAttr = unknown> {
  world: World<TAttr>
  cam: Camera
  viewport: Viewport
  zCards: number
  selectedId: string | null
  /** Raw 0..1 focus blend as held by the frame holder (the only place that
      advances it); eased here into focusK. */
  focusBlend: number
  /** Screen-px padding beyond the viewport for culling (per-caller:
      dot radius, label size, recenter reach). */
  margin: number
  config?: LayoutConfig
}

export function deriveScene<TAttr = unknown>({
  world,
  cam,
  viewport,
  zCards,
  selectedId,
  focusBlend,
  margin,
  config = layoutConfig,
}: SceneParams<TAttr>): Scene<TAttr> {
  const { w, h } = viewport
  const zoom = cam.zoom
  const focus = focusForSelection(world, selectedId)
  const focusK = focus ? smoothstep(0, 1, focusBlend) : 0
  // One shared cache per scene — the contract above is what makes the
  // per-frame allocation cheap: morphs are computed once for all layers.
  const morphs = new Map<string, RoomMorph>()

  const project = (x: number, y: number): [number, number] => [
    w / 2 + (x - cam.x) * zoom,
    h / 2 + (y - cam.y) * zoom,
  ]

  const ringTargets = new Map<string, [number, number]>()
  if (focus) {
    const center = roomMorph(world, world.nodeById.get(focus.id)!, zoom, cam, zCards, morphs, config)
      .pos
    for (const [id, pos] of focusRingTargets(world, focus, center, zoom, config)) {
      ringTargets.set(id, pos)
    }
  }

  const entries: SceneEntry<TAttr>[] = visibleNodes(
    world,
    cam,
    w,
    h,
    zCards,
    margin,
    morphs,
    config,
  ).map((e) => ({ node: e.node as CavinNode<TAttr>, morph: e.morph, sx: e.sx, sy: e.sy }))

  // Focus constellation members off-screen are still projected so the
  // layers can draw chips/edges traveling toward their ring slots.
  if (focus) {
    const seen = new Set(entries.map((e) => e.node.id))
    for (const id of [...focus.ringIds, ...focus.childIds]) {
      if (seen.has(id)) continue
      const node = world.nodeById.get(id)
      if (!node) continue
      const morph = roomMorph(world, node, zoom, cam, zCards, morphs, config)
      const [sx, sy] = project(morph.pos[0], morph.pos[1])
      entries.push({ node, morph, sx, sy, offscreen: true })
    }
  }

  return { world, cam, viewport, morphs, entries, focus, focusK, ringTargets, project }
}
