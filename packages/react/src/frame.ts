import type { Camera, LayoutConfig, Scene, World } from '@cavin/core'
import { deriveScene, layoutConfig } from '@cavin/core'

/**
 * The frame holder is the per-canvas owner of everything that must happen
 * exactly once per rendered frame, shared by the painter layers:
 *
 * - the focus-blend animation (0→1 while a selection focus is active,
 *   reset on deselect) — this is the ONLY place the blend advances;
 * - the viewport, written by Board every tick (Board is the sole source —
 *   painters never read window.innerWidth);
 * - the derived Scene(s), memoized per margin for the frame's
 *   (world, cam, zCards, selectedId, viewport) inputs. All layers painting
 *   the same frame share one Scene and therefore one room-morph cache —
 *   the contract documented on Scene.morphs is what makes this safe.
 */
export interface FrameHolder {
  /** Board's tick calls this once per frame with whether a focus is active. */
  advanceFocus(focusActive: boolean): void
  /** Current raw 0..1 focus blend (eased into focusK inside the scene). */
  focusBlend(): number
  /** Board writes the container size every tick; painters read it back. */
  setViewport(viewport: ViewportSize): void
  getViewport(): ViewportSize
  /**
   * The scene for this frame — the same object is handed to every layer
   * that asks with the same inputs within one frame. `margin` selects the
   * cull padding (dot radius, label size, recenter reach); one cached scene
   * per margin per frame.
   */
  scene<TAttr>(
    world: World<TAttr>,
    cam: Camera,
    zCards: number,
    selectedId: string | null,
    viewport: ViewportSize,
    margin: number,
  ): Scene<TAttr>
}

export interface ViewportSize {
  w: number
  h: number
}

export function createFrameHolder(config: LayoutConfig = layoutConfig): FrameHolder {
  let focusBlend = 0
  let viewport: ViewportSize = { w: 0, h: 0 }
  // Frame inputs, by reference: when none of them moved, every cached scene
  // from last frame is still valid and is handed back as-is.
  let inputs: {
    world: unknown
    cam: Camera
    zCards: number
    selectedId: unknown
    viewport: ViewportSize
  } | null = null
  let scenes = new Map<number, Scene<unknown>>()

  return {
    advanceFocus(focusActive) {
      focusBlend = focusActive
        ? Math.min(1, focusBlend + (1 - focusBlend) * config.focus.blendRate)
        : 0
    },
    focusBlend: () => focusBlend,
    setViewport(v) {
      viewport = v
    },
    getViewport: () => viewport,
    scene(world, cam, zCards, selectedId, vp, margin) {
      if (
        !inputs ||
        inputs.world !== world ||
        inputs.cam !== cam ||
        inputs.zCards !== zCards ||
        inputs.selectedId !== selectedId ||
        inputs.viewport.w !== vp.w ||
        inputs.viewport.h !== vp.h
      ) {
        inputs = { world, cam, zCards, selectedId, viewport: vp }
        scenes = new Map()
      }
      let hit = scenes.get(margin)
      if (!hit) {
        hit = deriveScene({
          world,
          cam,
          viewport: vp,
          zCards,
          selectedId,
          focusBlend,
          margin,
          config,
        }) as Scene<unknown>
        scenes.set(margin, hit)
      }
      return hit as Scene<never>
    },
  }
}
