/**
 * All layout / LOD / interaction tuning in one place. Every value here
 * was previously a bare literal scattered across store.ts, data/layout.ts,
 * board/lod.ts, board/Board.tsx and board/NodeLabelLayer.tsx; the defaults
 * are exactly those literals, so behavior is unchanged.
 *
 * Canvas paint
 * alphas (blob/edge/dot styling in DotsCanvas, Minimap) are visual
 * styling, not layout behavior, and intentionally stay inline.
 *
 * `mergeConfig` deep-merges host overrides over `layoutConfig` — the
 * per-instance configuration seam for embedded canvases.
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
    /** Node chip font sizes (px): base label, child labels (hang below the
        dot), room nameplates. User feedback: 10–11px was unreadable, so the
        defaults sit one step up. Applied inline by NodeLabelLayer; the CSS
        values are just pre-first-frame fallbacks. */
    fontSize: number
    childFontSize: number
    roomFontSize: number
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
    /** Minimum drawn radius of a leaf cluster (world units). */
    clusterRadiusMin: number
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
    /** Hue/saturation for ungrouped nodes (empty groupPath) — the neutral
        tint of free-space items in hosts with no grouping levels. */
    ungroupedHue: number
    ungroupedSaturation: number
  }
  edges: {
    /** Cosine-similarity floor for a machine-suggested cross-domain edge. */
    simThreshold: number
    /** Per-node cap on suggested edges (top-K by similarity). */
    maxPerNode: number
    /** Aggregated arc line width = arcWidthBase + arcWidthPerEdge × ln(count). */
    arcWidthBase: number
    arcWidthPerEdge: number
    /** Perpendicular bend of arcs/curves, as a fraction of endpoint distance. */
    arcBend: number
    /** Selection spotlight: alpha/width for edges touching the selected node. */
    spotlightAlpha: number
    spotlightWidth: number
    /** Alpha multiplier for unrelated edges (and bundles) while spotlighting. */
    dimFactor: number
    /** Alpha multiplier for unrelated node dots while spotlighting. */
    dotDimFactor: number
    /** Far-LOD bundle alpha when it carries a selected node's edge. */
    bundleSpotAlpha: number
    /** Relation label on a spotlighted arc: font size (screen px), max
        chars before truncation, and min screen length of an arc that gets
        a label at all. */
    labelFontSize: number
    labelMaxLen: number
    labelMinDist: number
    /** Focus mode (selection with confirmed edges): halo ring around the
        related dots — extra radius (screen px) and stroke alpha. */
    focusRingPad: number
    focusRingAlpha: number
    /** Opacity of wing/room cluster labels while focus mode is active. */
    focusLabelAlpha: number
  }
  focus: {
    /** Selection constellation: confirmed neighbors gather onto a ring
        around the selected node. Ring radius in screen px — constant across
        zooms, so the constellation stays readable zoomed out — with a
        per-neighbor minimum arc so crowded rings grow instead of
        overlapping. */
    ringRadiusPx: number
    ringPerNodePx: number
    /** Inner ring for the selected node's children (family sits close to
        the center, relations on the outer ring). Same growth rule. */
    innerRingPx: number
    /** Per-frame ease rate of the gather animation (0..1). */
    blendRate: number
  }
  importance: {
    /** Hub emphasis: dot radius scales up to × (1 + sizeBoost) and alpha up
        by alphaBoost at max normalized degree (degree / maxDegree). */
    sizeBoost: number
    alphaBoost: number
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
    chipHeight: 22,
    chipMaxWidth: 180,
    fontSize: 12,
    childFontSize: 11,
    roomFontSize: 13,
    chipBaseWidth: 16,
    chipCharWidth: 6.6,
    chipKidsWidth: 24,
    nameplateOpen: 0.45,
    declutterCell: 48,
  },
  layout: {
    topLevelRadius: 1500,
    groupSpreadMin: 250,
    groupSpreadMax: 420,
    itemSigma: 55,
    clusterRadiusMin: 60,
    childOrbitSigma: 18,
    childSpawnRadiusMin: 16,
    childSpawnRadiusSpread: 12,
    hueStep: 60,
    hueOffset: 15,
    colorSaturation: 70,
    colorLightness: 62,
    ungroupedHue: 220,
    ungroupedSaturation: 20,
  },
  edges: {
    // Tuned against the seeded palace: cross-wing per-node best sims sit
    // around 0.8 (median), so 0.9 yields ~230 suggestions over ~1087 notes
    // — visible without turning into spaghetti.
    simThreshold: 0.9,
    maxPerNode: 2,
    arcWidthBase: 0.8,
    arcWidthPerEdge: 1.2,
    arcBend: 0.18,
    spotlightAlpha: 0.95,
    spotlightWidth: 2.5,
    dimFactor: 0.15,
    dotDimFactor: 0.55,
    bundleSpotAlpha: 0.85,
    labelFontSize: 12,
    labelMaxLen: 14,
    labelMinDist: 60,
    focusRingPad: 2.6,
    focusRingAlpha: 0.95,
    focusLabelAlpha: 0.22,
  },
  focus: {
    ringRadiusPx: 260,
    ringPerNodePx: 64,
    innerRingPx: 92,
    blendRate: 0.16,
  },
  importance: {
    sizeBoost: 1.1,
    alphaBoost: 0.5,
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

/** Deep-merge host overrides over the defaults (plain objects only — the
    config holds no arrays or class instances). Returns a new object. */
export function mergeConfig(base: LayoutConfig, overrides: DeepPartial<LayoutConfig>): LayoutConfig {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue
    const current = out[key]
    out[key] =
      typeof value === 'object' && value !== null && !Array.isArray(value) &&
      typeof current === 'object' && current !== null && !Array.isArray(current)
        ? mergeConfig(current as unknown as LayoutConfig, value as unknown as DeepPartial<LayoutConfig>)
        : value
  }
  return out as unknown as LayoutConfig
}

export type DeepPartial<T> = {
  [K in keyof T]: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
