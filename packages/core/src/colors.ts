import { layoutConfig } from './config'

/**
 * Color plumbing. Nodes and clusters do NOT carry colors — color is
 * presentation, derived from the group path via `adapter.colorOf` (or the
 * default hue rotation) at render time. These helpers back the default
 * scheme and let canvas renderers build alpha variants of any host color.
 */

/** The default scheme: deterministic hue rotation over the top-level group
    (first-encounter order), the demo's wingHue scheme. */
export function defaultHue(topIndex: number): number {
  const { hueStep, hueOffset } = layoutConfig.layout
  return (topIndex * hueStep + hueOffset) % 360
}

export function hsl(hue: number, saturation?: number, lightness?: number): string {
  const s = saturation ?? layoutConfig.layout.colorSaturation
  const l = lightness ?? layoutConfig.layout.colorLightness
  return `hsl(${hue}, ${s}%, ${l}%)`
}

export function hsla(hue: number, alpha: number): string {
  return `hsla(${hue}, ${layoutConfig.layout.colorSaturation}%, ${layoutConfig.layout.colorLightness}%, ${alpha})`
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

/** Color with an alpha channel, for canvas gradients and fades. Understands
    hsl/hsla/hex/rgb; any other CSS color is returned unchanged (renderers
    that need alpha then fall back to `globalAlpha`). */
export function withAlpha(color: string, alpha: number): string {
  const m = HSL_RE.exec(color)
  if (m) {
    // Re-inject alpha into the original string so saturation/lightness
    // expressions pass through untouched.
    const rest = color.slice(m[0].length)
    return `hsla(${m[1]}, ${rest.replace(/\)$/, '').trim()}, ${alpha})`
  }
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
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const rgb = RGB_RE.exec(color)
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`
  return color
}
