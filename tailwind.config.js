/** @type {import('tailwindcss').Config} */

// Warna & bentuk dipetakan ke variabel CSS supaya tema bisa diganti saat runtime
// (lihat src/lib/themes.ts + useThemeEffect). Setiap var punya fallback agar
// tampilan tetap benar sebelum JS menerapkan tema.
const c = (name, fallback) => `rgb(var(${name}, ${fallback}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: c('--brand-50', '238 242 255'),
          100: c('--brand-100', '224 231 255'),
          200: c('--brand-200', '199 210 254'),
          300: c('--brand-300', '165 180 252'),
          400: c('--brand-400', '129 140 248'),
          500: c('--brand-500', '99 102 241'),
          600: c('--brand-600', '79 70 229'),
          700: c('--brand-700', '67 56 202'),
          800: c('--brand-800', '55 48 163'),
          900: c('--brand-900', '49 46 129'),
        },
        canvas: c('--canvas', '248 250 252'),
        surface: { DEFAULT: c('--surface', '255 255 255'), 2: c('--surface-2', '241 245 249') },
        line: c('--line', '226 232 240'),
        ink: c('--ink', '15 23 42'),
        muted: c('--muted', '100 116 139'),
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      borderWidth: { DEFAULT: 'var(--bw, 1px)' },
      borderRadius: {
        card: 'var(--radius-card, 1rem)',
        btn: 'var(--radius-btn, 0.75rem)',
        field: 'var(--radius-field, 0.75rem)',
      },
      boxShadow: {
        card: 'var(--sh-card, 0 1px 2px 0 rgb(15 23 42 / 0.05), 0 1px 3px 0 rgb(15 23 42 / 0.06))',
        pop: 'var(--sh-pop, 0 10px 40px -12px rgb(15 23 42 / 0.25))',
        btn: 'var(--sh-btn, 0 0 #0000)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        overlay: { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'fade-up': 'fade-up .25s ease-out',
        overlay: 'overlay .2s ease-out',
        'sheet-up': 'sheet-up .3s cubic-bezier(.32,.72,0,1)',
        'scale-in': 'scale-in .18s ease-out',
      },
    },
  },
  plugins: [],
}
