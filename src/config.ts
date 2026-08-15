/**
 * All layout / LOD / interaction tuning in one place. Every value here
 * was previously a bare literal scattered across store.ts, data/layout.ts,
 * board/lod.ts, board/Board.tsx and board/NodeLabelLayer.tsx; the defaults
 * are exactly those literals, so behavior is unchanged.
 *
 * Host overrides (deep-merge, per-instance) arrive with the framework
 * split — see docs/architecture-generic-framework.md §4.6. Canvas paint
 * alphas (blob/edge/dot styling in DotsCanvas, Minimap) are visual
 * styling, not layout behavior, and intentionally stay inline.
 */
export interface LayoutConfig {
  camera: {
    /** Zoom bounds. maxZoom must be deep enough to pass THROUGH the deepest
        rooms: revealZoom saturates at lod.revealSaturateDepth, and full
        pass-through needs × room.passFull more. */
    minZoom: number
    maxZoom: number
    /** Wheel zoom speed: zoom multiplies by exp(-delta × wheelSpeed). */
    wheelSpeed: number
    /** Camera easing rates: selection fly-to vs wheel follow. */
    focusRate: number
    wheelRate: number
  }
  lod: {
    /** Default zoom thresholds: room labels appear / full cards appear.
        User-tunable at runtime (HUD sliders), persisted by the view store. */
    zRooms: number
    zCards: number
    /** Depth→zoom: revealZoom = zCards × revealBase × revealExponent^(depth-1),
        saturating so arbitrarily deep chains stay reachable within maxZoom —
        deeper levels are reached spatially, not by zooming forever. */
    revealBase: number
    revealExponent: number
    revealSaturateDepth: number
    /** A child depth opens over zoom in [reveal, reveal × gateRamp]. */
    gateRamp: number
    /** Screen-px radius of the focused region around the viewport center;
        only families inside it open their rooms. */
    focusRadius: number
    /** Node-label band fades in over [zRooms × chipFadeStart, zRooms ×
        chipFadeFull] and never fades out. */
    chipFadeStart: number
    chipFadeFull: number
  }
  room: {
    /** Children spread onto a ring at this fraction of the room radius. */
    ringFraction: number
    /** Room screen radius = max(radiusMin, radiusPerChild × √children). */
    radiusMin: number
    radiusPerChild: number
    /** Pass-through: past revealZoom × passStart the camera enters the room;
        by × passFull the boundary has faded; the screen radius grows by
        passGrow while passing so children fill the view. */
    passStart: number
    passFull: number
    passGrow: number
    /** Drawn radius ease as a room opens: radiusEaseMin + (1 − min) × open. */
    radiusEaseMin: number
  }
  labels: {
    /** Hard cap on simultaneously visible node labels. */
    maxChips: number
    chipHeight: number
    chipMaxWidth: number
    /** Width estimate: chipBaseWidth + chars × chipCharWidth (+ chipKidsWidth
        when the node has children). */
    chipBaseWidth: number
    chipCharWidth: number
    chipKidsWidth: number
    /** A parent's label becomes the room nameplate past this openness. */
    nameplateOpen: number
    /** Uniform-grid cell (screen px) for label collision decluttering. */
    declutterCell: number
  }
  layout: {
    /** Initial scatter: top-level groups evenly on a circle of this radius. */
    topLevelRadius: number
    groupSpreadMin: number
    groupSpreadMax: number
    /** Gaussian sigma for items around their group centroid. */
    itemSigma: number
    /** Gaussian sigma for a child's orbit around its parent. */
    childOrbitSigma: number
    /** Orbit radius for a freshly attached child (add-child / re-parent). */
    childSpawnRadiusMin: number
    childSpawnRadiusSpread: number
    /** Group hue = (index × hueStep + hueOffset) % 360. */
    hueStep: number
    hueOffset: number
    colorSaturation: number
    colorLightness: number
  }
  interaction: {
    /** Pointer travel (screen px) before a press becomes a drag. */
    dragThreshold: number
    /** Drop-target snap radius (screen px). */
    dropRadius: number
    /** Selection fly-to zoom: parents land at revealZoom × focusKidsZoom
        (inside the room); leaves at revealZoom × focusLeafZoom but at least
        zRooms × focusMinZoom. */
    focusKidsZoom: number
    focusLeafZoom: number
    focusMinZoom: number
    /** Weak re-centering while passing through a room: when the deepest
        entered room drifts past recenterDistance screen px from the target,
        ease the target toward it by recenterRate per frame. */
    recenterDistance: number
    recenterRate: number
  }
}

export const layoutConfig: LayoutConfig = {
  camera: {
    minZoom: 0.04,
    maxZoom: 9,
    wheelSpeed: 0.0016,
    focusRate: 0.14,
    wheelRate: 0.3,
  },
  lod: {
    zRooms: 0.15,
    zCards: 0.5,
    revealBase: 1.05,
    revealExponent: 1.45,
    revealSaturateDepth: 6,
    gateRamp: 1.3,
    focusRadius: 320,
    chipFadeStart: 0.85,
    chipFadeFull: 1.2,
  },
  room: {
    ringFraction: 0.62,
    radiusMin: 110,
    radiusPerChild: 62,
    passStart: 1.5,
    passFull: 2.6,
    passGrow: 2.2,
    radiusEaseMin: 0.35,
  },
  labels: {
    maxChips: 200,
    chipHeight: 20,
    chipMaxWidth: 180,
    chipBaseWidth: 16,
    chipCharWidth: 5.8,
    chipKidsWidth: 24,
    nameplateOpen: 0.45,
    declutterCell: 48,
  },
  layout: {
    topLevelRadius: 1500,
    groupSpreadMin: 250,
    groupSpreadMax: 420,
    itemSigma: 55,
    childOrbitSigma: 18,
    childSpawnRadiusMin: 16,
    childSpawnRadiusSpread: 12,
    hueStep: 60,
    hueOffset: 15,
    colorSaturation: 70,
    colorLightness: 62,
  },
  interaction: {
    dragThreshold: 4,
    dropRadius: 28,
    focusKidsZoom: 2.4,
    focusLeafZoom: 1.15,
    focusMinZoom: 1.3,
    recenterDistance: 180,
    recenterRate: 0.15,
  },
}
