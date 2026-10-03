/**
 * Preset tema UI.
 *
 * Setiap tema mendefinisikan variabel CSS yang dipakai `tailwind.config.js`
 * (lihat pemetaan warna `brand`/`surface`/`line`/`ink`, sudut `rounded-card`,
 * bayangan `shadow-card`, dan ketebalan `border`). `useThemeEffect` menulis
 * variabel ini ke <html> saat pengaturan berubah — jadi tema bisa berganti
 * tanpa membangun ulang CSS.
 *
 * Semua warna ditulis sebagai triplet RGB ("R G B") agar bisa dipakai Tailwind
 * dengan pengubah opasitas (mis. `bg-brand-600/40`).
 *
 * Selain preset di bawah, tersedia tema kustom dari satu warna aksen — lihat
 * `customTheme()` / `resolveTheme()` dan src/lib/accent.ts.
 */

import { deriveBrandRamp } from './accent'

export interface ThemeTokens {
  /** Palet aksen 50 → 900 (triplet RGB) */
  brand: [string, string, string, string, string, string, string, string, string, string]
  canvas: string
  surface: string
  surface2: string
  line: string
  ink: string
  muted: string
  ring: string
  /** Ketebalan garis default (dipakai kelas `border`) */
  bw: string
  radiusCard: string
  radiusBtn: string
  radiusField: string
  shCard: string
  shPop: string
  shBtn: string
}

export interface UiTheme {
  id: string
  name: string
  desc: string
  /** Warna ringkas untuk pratinjau di Pengaturan (hex) */
  swatch: { canvas: string; surface: string; brand: string; ink: string }
  light: ThemeTokens
  dark: ThemeTokens
}

const INDIGO: ThemeTokens['brand'] = ['238 242 255', '224 231 255', '199 210 254', '165 180 252', '129 140 248', '99 102 241', '79 70 229', '67 56 202', '55 48 163', '49 46 129']
const TERRACOTTA: ThemeTokens['brand'] = ['251 243 239', '247 228 220', '239 200 184', '229 168 143', '222 143 111', '217 119 87', '192 94 62', '158 74 47', '124 58 37', '95 46 30']
const STRIPE_BLURPLE: ThemeTokens['brand'] = ['240 240 255', '227 226 255', '200 199 255', '168 166 255', '130 127 255', '99 91 255', '84 72 236', '68 56 202', '54 45 160', '42 36 130']
const BRUTAL_BLUE: ThemeTokens['brand'] = ['239 246 255', '219 234 254', '191 219 254', '147 197 253', '96 165 250', '59 130 246', '37 99 235', '29 78 216', '30 64 175', '30 58 138']
const CLAY_VIOLET: ThemeTokens['brand'] = ['244 243 255', '233 230 255', '213 208 255', '187 179 255', '158 147 250', '124 108 240', '104 88 224', '86 70 196', '68 55 156', '54 44 122']
const SOFT_BLUE: ThemeTokens['brand'] = ['240 244 255', '226 233 255', '202 214 255', '170 188 255', '132 156 255', '92 124 255', '74 102 230', '58 82 196', '46 66 156', '36 52 122']

export const UI_THEMES: UiTheme[] = [
  {
    id: 'indigo-modern',
    name: 'Indigo Modern',
    desc: 'Netral & profesional — bawaan, kontras aman untuk semua jenis usaha.',
    swatch: { canvas: '#f8fafc', surface: '#ffffff', brand: '#4f46e5', ink: '#0f172a' },
    light: {
      brand: INDIGO, canvas: '248 250 252', surface: '255 255 255', surface2: '241 245 249',
      line: '226 232 240', ink: '15 23 42', muted: '100 116 139', ring: '79 70 229',
      bw: '1px', radiusCard: '1rem', radiusBtn: '0.75rem', radiusField: '0.75rem',
      shCard: '0 1px 2px 0 rgb(15 23 42 / 0.05), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
      shPop: '0 10px 40px -12px rgb(15 23 42 / 0.25)',
      shBtn: '0 0 #0000',
    },
    dark: {
      brand: INDIGO, canvas: '2 6 23', surface: '15 23 42', surface2: '30 41 59',
      line: '30 41 59', ink: '241 245 249', muted: '148 163 184', ring: '129 140 248',
      bw: '1px', radiusCard: '1rem', radiusBtn: '0.75rem', radiusField: '0.75rem',
      shCard: '0 1px 2px 0 rgb(0 0 0 / 0.4), 0 1px 3px 0 rgb(0 0 0 / 0.3)',
      shPop: '0 10px 40px -12px rgb(0 0 0 / 0.6)',
      shBtn: '0 0 #0000',
    },
  },
  {
    id: 'claude',
    name: 'Claude',
    desc: 'Hangat & lembut — krem gading dengan aksen terakota, nyaman dilihat lama.',
    swatch: { canvas: '#f5f4ef', surface: '#fffdfa', brand: '#c05e3e', ink: '#2d2b26' },
    light: {
      brand: TERRACOTTA, canvas: '245 244 239', surface: '255 253 250', surface2: '240 238 230',
      line: '226 222 210', ink: '45 43 38', muted: '120 116 106', ring: '192 94 62',
      bw: '1px', radiusCard: '1.25rem', radiusBtn: '0.75rem', radiusField: '0.625rem',
      shCard: '0 1px 2px rgb(60 50 40 / 0.04), 0 2px 8px rgb(60 50 40 / 0.05)',
      shPop: '0 20px 50px -20px rgb(60 50 40 / 0.35)',
      shBtn: '0 0 #0000',
    },
    dark: {
      brand: TERRACOTTA, canvas: '38 38 36', surface: '48 48 46', surface2: '58 58 55',
      line: '70 68 64', ink: '245 244 239', muted: '168 162 152', ring: '222 143 111',
      bw: '1px', radiusCard: '1.25rem', radiusBtn: '0.75rem', radiusField: '0.625rem',
      shCard: '0 1px 2px rgb(0 0 0 / 0.45), 0 2px 8px rgb(0 0 0 / 0.35)',
      shPop: '0 20px 50px -20px rgb(0 0 0 / 0.7)',
      shBtn: '0 0 #0000',
    },
  },
  {
    id: 'stripe',
    name: 'Stripe',
    desc: 'Tajam & presisi — putih bersih dengan aksen ungu-biru dan sudut rapi.',
    swatch: { canvas: '#f7f8fc', surface: '#ffffff', brand: '#5448ec', ink: '#0a2540' },
    light: {
      brand: STRIPE_BLURPLE, canvas: '247 248 252', surface: '255 255 255', surface2: '243 244 250',
      line: '226 232 240', ink: '10 37 64', muted: '66 84 102', ring: '99 91 255',
      bw: '1px', radiusCard: '0.75rem', radiusBtn: '0.5rem', radiusField: '0.5rem',
      shCard: '0 1px 1px rgb(10 37 64 / 0.04), 0 2px 5px rgb(10 37 64 / 0.06)',
      shPop: '0 12px 32px -8px rgb(10 37 64 / 0.28)',
      shBtn: '0 1px 2px rgb(10 37 64 / 0.12)',
    },
    dark: {
      brand: STRIPE_BLURPLE, canvas: '13 18 28', surface: '22 27 40', surface2: '32 38 54',
      line: '45 52 70', ink: '235 240 250', muted: '148 160 180', ring: '130 127 255',
      bw: '1px', radiusCard: '0.75rem', radiusBtn: '0.5rem', radiusField: '0.5rem',
      shCard: '0 1px 1px rgb(0 0 0 / 0.35), 0 2px 6px rgb(0 0 0 / 0.3)',
      shPop: '0 12px 32px -8px rgb(0 0 0 / 0.6)',
      shBtn: '0 1px 2px rgb(0 0 0 / 0.4)',
    },
  },
  {
    id: 'neubrutalism',
    name: 'Neubrutalism',
    desc: 'Berani & tegas — garis hitam tebal, sudut siku, bayangan keras tanpa blur.',
    swatch: { canvas: '#ffffff', surface: '#ffffff', brand: '#2563eb', ink: '#000000' },
    light: {
      brand: BRUTAL_BLUE, canvas: '255 255 255', surface: '255 255 255', surface2: '244 244 245',
      line: '0 0 0', ink: '0 0 0', muted: '63 63 70', ring: '0 0 0',
      bw: '2px', radiusCard: '0px', radiusBtn: '0px', radiusField: '0px',
      shCard: '4px 4px 0 0 #000', shPop: '8px 8px 0 0 #000', shBtn: '3px 3px 0 0 #000',
    },
    dark: {
      brand: BRUTAL_BLUE, canvas: '0 0 0', surface: '18 18 18', surface2: '32 32 32',
      line: '255 255 255', ink: '255 255 255', muted: '180 180 180', ring: '255 255 255',
      bw: '2px', radiusCard: '0px', radiusBtn: '0px', radiusField: '0px',
      shCard: '4px 4px 0 0 #fff', shPop: '8px 8px 0 0 #fff', shBtn: '3px 3px 0 0 #fff',
    },
  },
  {
    id: 'claymorphism',
    name: 'Claymorphism',
    desc: 'Empuk & membulat — permukaan pastel dengan sudut besar dan bayangan lembut.',
    swatch: { canvas: '#eef0fa', surface: '#f6f7ff', brand: '#6858e0', ink: '#2d2a46' },
    light: {
      brand: CLAY_VIOLET, canvas: '238 240 250', surface: '246 247 255', surface2: '233 236 250',
      line: '220 224 245', ink: '45 42 70', muted: '120 118 150', ring: '124 108 240',
      bw: '1px', radiusCard: '1.75rem', radiusBtn: '1.25rem', radiusField: '1rem',
      shCard: '0 16px 32px -14px rgb(112 106 190 / 0.45), inset 0 -6px 12px rgb(255 255 255 / 0.9), inset 0 6px 12px rgb(150 150 220 / 0.14)',
      shPop: '0 30px 60px -20px rgb(90 86 160 / 0.5)',
      shBtn: '0 8px 16px -8px rgb(112 106 190 / 0.6)',
    },
    dark: {
      brand: CLAY_VIOLET, canvas: '30 30 46', surface: '40 40 60', surface2: '50 50 74',
      line: '60 60 88', ink: '236 236 248', muted: '160 160 190', ring: '158 147 250',
      bw: '1px', radiusCard: '1.75rem', radiusBtn: '1.25rem', radiusField: '1rem',
      shCard: '0 16px 32px -14px rgb(0 0 0 / 0.6), inset 0 -6px 12px rgb(60 60 90 / 0.5), inset 0 6px 12px rgb(120 120 180 / 0.1)',
      shPop: '0 30px 60px -20px rgb(0 0 0 / 0.7)',
      shBtn: '0 8px 16px -8px rgb(0 0 0 / 0.6)',
    },
  },
  {
    id: 'soft-ui',
    name: 'Soft UI Evolution',
    desc: 'Neumorfik — permukaan menyatu dengan latar, timbul lewat bayangan ganda.',
    swatch: { canvas: '#e8ecf3', surface: '#e8ecf3', brand: '#4a66e6', ink: '#343c4c' },
    light: {
      brand: SOFT_BLUE, canvas: '232 236 243', surface: '232 236 243', surface2: '224 229 238',
      line: '214 220 231', ink: '52 60 76', muted: '110 120 138', ring: '92 124 255',
      bw: '1px', radiusCard: '1.25rem', radiusBtn: '0.875rem', radiusField: '0.875rem',
      shCard: '8px 8px 18px rgb(186 194 210 / 0.75), -8px -8px 18px rgb(255 255 255 / 0.95)',
      shPop: '16px 16px 40px rgb(170 178 196 / 0.7), -12px -12px 32px rgb(255 255 255 / 0.9)',
      shBtn: '4px 4px 10px rgb(186 194 210 / 0.8), -4px -4px 10px rgb(255 255 255 / 0.95)',
    },
    dark: {
      brand: SOFT_BLUE, canvas: '34 38 48', surface: '34 38 48', surface2: '40 45 56',
      line: '48 54 66', ink: '226 232 242', muted: '148 158 176', ring: '132 156 255',
      bw: '1px', radiusCard: '1.25rem', radiusBtn: '0.875rem', radiusField: '0.875rem',
      shCard: '8px 8px 18px rgb(20 22 28 / 0.85), -8px -8px 18px rgb(58 64 78 / 0.55)',
      shPop: '16px 16px 40px rgb(16 18 24 / 0.8), -12px -12px 32px rgb(60 66 80 / 0.5)',
      shBtn: '4px 4px 10px rgb(20 22 28 / 0.9), -4px -4px 10px rgb(58 64 78 / 0.6)',
    },
  },
]

export const DEFAULT_THEME_ID = 'indigo-modern'
/** Tema kustom: warna aksen dipilih pengguna, palet diturunkan otomatis. */
export const CUSTOM_THEME_ID = 'custom'

export function themeById(id?: string | null): UiTheme {
  return UI_THEMES.find((t) => t.id === id) ?? UI_THEMES[0]
}

/** Bangun tema dari satu warna aksen: permukaan/bentuk mengikuti tema bawaan,
 *  hanya palet aksennya yang diturunkan (dengan jaminan kontras). */
export function customTheme(accentHex: string): UiTheme {
  const ramp = deriveBrandRamp(accentHex)
  const base = UI_THEMES[0]
  const css = (trip: string) => `rgb(${trip})`
  return {
    id: CUSTOM_THEME_ID,
    name: 'Kustom',
    desc: 'Warna aksen pilihan Anda — palet 50–900 diturunkan otomatis dengan kontras aman.',
    swatch: { canvas: css(base.light.canvas), surface: css(base.light.surface), brand: css(ramp[6]), ink: css(base.light.ink) },
    light: { ...base.light, brand: ramp },
    dark: { ...base.dark, brand: ramp },
  }
}

/** Tema efektif dari pengaturan (preset atau kustom). */
export function resolveTheme(id?: string | null, accent?: string | null): UiTheme {
  if (id === CUSTOM_THEME_ID) return customTheme(accent || '#4f46e5')
  return themeById(id)
}

/** Variabel CSS siap pakai untuk <html>: { '--brand-600': '79 70 229', ... } */
export function themeVars(theme: UiTheme, dark: boolean): Record<string, string> {
  const t = dark ? theme.dark : theme.light
  const vars: Record<string, string> = {
    '--canvas': t.canvas,
    '--surface': t.surface,
    '--surface-2': t.surface2,
    '--line': t.line,
    '--ink': t.ink,
    '--muted': t.muted,
    '--ring': t.ring,
    '--bw': t.bw,
    '--radius-card': t.radiusCard,
    '--radius-btn': t.radiusBtn,
    '--radius-field': t.radiusField,
    '--sh-card': t.shCard,
    '--sh-pop': t.shPop,
    '--sh-btn': t.shBtn,
  }
  const brandKeys = ['--brand-50', '--brand-100', '--brand-200', '--brand-300', '--brand-400', '--brand-500', '--brand-600', '--brand-700', '--brand-800', '--brand-900']
  brandKeys.forEach((k, i) => { vars[k] = t.brand[i] })
  return vars
}
