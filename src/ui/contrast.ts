/** WCAG relative luminance for an sRGB channel in 0–255. */
function channelLuminance(channel: number): number {
  const value = channel / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export type RgbColor = { r: number; g: number; b: number }

/** Parse `rgb(...)` / `rgba(...)` from getComputedStyle. */
export function parseCssRgb(color: string): RgbColor | null {
  const match = color.match(
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*[\d.%]+)?\s*\)$/i,
  )
  if (!match) return null
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  }
}

export function relativeLuminance(color: RgbColor): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  )
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrastRatio(foreground: RgbColor, background: RgbColor): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

/** Agreed baseline: WCAG AA for normal text. */
export const CONTRAST_BASELINE = 4.5
