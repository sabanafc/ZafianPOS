/**
 * Penurunan palet aksen 50–900 dari satu warna pilihan pengguna.
 *
 * Tujuannya bukan sekadar "warnanya mirip", tapi **menjaga kontras**:
 *  - `brand-600` & `brand-700` dipakai sebagai latar tombol berteks putih →
 *    digelapkan sampai rasio kontras vs putih ≥ 4.5:1 (WCAG AA teks normal).
 *  - `brand-600` juga dipakai sebagai teks di atas putih (mis. tautan) → syarat
 *    yang sama sudah terpenuhi dari aturan di atas.
 *  - `brand-400` dipakai sebagai teks di atas permukaan gelap (mode gelap) →
 *    diterangkan sampai ≥ 4.5:1 terhadap permukaan gelap.
 *  - `brand-500` dipakai sebagai aksen visual (batang grafik, ikon) → cukup ≥ 3:1.
 */

export interface Rgb { r: number; g: number; b: number }

/** Palet 10 langkah (50, 100, … 900) sebagai triplet RGB "R G B" */
export type BrandRamp = [string, string, string, string, string, string, string, string, string, string]

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
/** Permukaan gelap acuan (sama dengan tema bawaan di mode gelap) */
const DARK_SURFACE: Rgb = { r: 15, g: 23, b: 42 }

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToCss({ r, g, b }: Rgb): string {
  return `rgb(${r} ${g} ${b})`
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h *= 60
  if (h < 0) h += 360
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((h % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hp < 1) { r = c; g = x }
  else if (hp < 2) { r = x; g = c }
  else if (hp < 3) { g = c; b = x }
  else if (hp < 4) { g = x; b = c }
  else if (hp < 5) { r = x; b = c }
  else { r = c; b = x }
  const m = l - c / 2
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

/** Luminansi relatif WCAG 2.1 */
export function relLuminance({ r, g, b }: Rgb): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** Rasio kontras WCAG antara dua warna (1–21) */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relLuminance(a), lb = relLuminance(b)
  const hi = Math.max(la, lb), lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Turunkan palet 50–900 dari satu warna aksen.
 * @param hex warna apa pun dalam format #rrggbb atau #rgb
 */
export function deriveBrandRamp(hex: string): BrandRamp {
  const base = hexToRgb(hex) ?? { r: 79, g: 70, b: 229 }
  const hsl = rgbToHsl(base.r, base.g, base.b)
  const h = hsl.h
  // saturasi dijaga di rentang yang enak dilihat (tidak pucat, tidak menyala)
  const s = Math.min(0.9, Math.max(0.42, hsl.s))

  const target = [0.97, 0.94, 0.87, 0.78, 0.66, 0.56, 0.48, 0.4, 0.33, 0.27]

  /** gelapkan sampai kontras vs latar memenuhi rasio (atau batas tercapai) */
  const darkenUntil = (startL: number, bg: Rgb, ratio: number) => {
    let l = startL
    while (l > 0.06 && contrastRatio(hslToRgb(h, s, l), bg) < ratio) l -= 0.01
    return l
  }
  /** terangkan sampai kontras vs latar memenuhi rasio */
  const lightenUntil = (startL: number, bg: Rgb, ratio: number) => {
    let l = startL
    while (l < 0.97 && contrastRatio(hslToRgb(h, s, l), bg) < ratio) l += 0.01
    return l
  }

  // 600 = paling terang yang masih lolos kontras ≥4.5 vs putih (dipakai tombol & tautan).
  const l600 = darkenUntil(target[6], WHITE, 4.5)
  // 700 selalu lebih gelap dari 600 → kontras lebih tinggi, tetap lolos AA.
  const l700 = Math.min(target[7], l600 - 0.06)
  const l800 = Math.min(target[8], l700 - 0.07)
  const l900 = Math.min(target[9], l800 - 0.06)
  const l500 = darkenUntil(target[5], WHITE, 3)
  const l400 = lightenUntil(target[4], DARK_SURFACE, 4.5)

  const Ls = [target[0], target[1], target[2], target[3], l400, l500, l600, l700, l800, l900]
  return Ls.map((l) => {
    const { r, g, b } = hslToRgb(h, s, Math.max(0.05, Math.min(0.98, l)))
    return `${r} ${g} ${b}`
  }) as BrandRamp
}

/** Warna aksen "terpakai" (langkah 600) sebagai CSS color — untuk pratinjau */
export function accentPreviewColor(hex: string): string {
  const ramp = deriveBrandRamp(hex)
  const [r, g, b] = ramp[6].split(' ').map(Number)
  return rgbToCss({ r, g, b })
}
