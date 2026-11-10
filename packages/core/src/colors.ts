import { layoutConfig } from './config'
import type { LayoutConfig } from './config'

/**
 * Color plumbing. Nodes and clusters do NOT carry colors — color is
 * presentation, derived from the group path via `adapter.colorOf` (or the
 * default hue rotation) at render time. These helpers back the default
 * scheme and let canvas renderers build alpha variants of any host color.
 *
 * Every helper takes the resolved LayoutConfig (default: the global
 * defaults) so a per-instance `CavinCanvas config={…}` override actually
 * reaches the painted pixels.
 */

/** The default scheme: deterministic hue rotation over the top-level group
    (first-encounter order), the demo's wingHue scheme. */
export function defaultHue(topIndex: number, config: LayoutConfig = layoutConfig): number {
  const { hueStep, hueOffset } = config.layout
  return (topIndex * hueStep + hueOffset) % 360
}

export function hsl(
  hue: number,
  config: LayoutConfig = layoutConfig,
  saturation?: number,
  lightness?: number,
): string {
  const s = saturation ?? config.layout.colorSaturation
  const l = lightness ?? config.layout.colorLightness
  return `hsl(${hue}, ${s}%, ${l}%)`
}

export function hsla(hue: number, alpha: number, config: LayoutConfig = layoutConfig): string {
  return `hsla(${hue}, ${config.layout.colorSaturation}%, ${config.layout.colorLightness}%, ${alpha})`
}

const HSL_RE = /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]/
const HEX_RE = /^#([0-9a-f]{3,8})$/i
const RGB_RE = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/

/** Hue of a CSS color when it is one of the forms canvas work needs
    (hsl/hsla/hex/rgb) — null for anything unparseable (named colors etc.). */
export function hueFromColor(color: string): number | null {
  const m = HSL_RE.exec(color)
  if (m) return Number(m[1]) % 360
  const hex = HEX_RE.exec(color.trim())
  if (hex && (hex[1].length === 6 || hex[1].length === 3)) {
    const full =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((c) => c + c)
            .join('')
        : hex[1]
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    return rgbHue(r, g, b)
  }
  const rgb = RGB_RE.exec(color)
  if (rgb) return rgbHue(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]))
  return null
}

function rgbHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  return (h + 360) % 360
}
