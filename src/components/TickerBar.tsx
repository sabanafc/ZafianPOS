import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useIngredients } from '../hooks/useMaster'
import { useSettings } from '../hooks/useSettings'
import { fmtQty } from '../lib/utils'

/**
 * Running text di bawah layar (di atas bottom nav, di bawah konten):
 * bahan kritis + promo. In-flow, bukan overlay — jadi tidak pernah
 * menutupi panel keranjang atau tombol bayar kasir.
 */
export function TickerBar() {
  const { settings } = useSettings()
  const { data: ingredients = [] } = useIngredients()

  const items = useMemo(() => {
    const list: string[] = []
    const low = ingredients.filter((i) => i.is_active && i.stock <= i.min_stock)
    if (low.length) {
      const shown = low
        .slice(0, 4)
        .map((i) => `${i.name} ${fmtQty(i.stock)} ${i.unit}`)
        .join(', ')
      list.push(`STOK KRITIS (${low.length}): ${shown}${low.length > 4 ? ', …' : ''}`)
    }
    const promo = settings?.promo_text?.trim()
    if (promo) list.push(`PROMO: ${promo}`)
    return list
  }, [ingredients, settings?.promo_text])

  if (!items.length) return null
  const text = items.join('   •   ')

  return (
    <div
      className="ticker relative flex h-8 shrink-0 items-center overflow-hidden border-t border-line bg-ink text-xs font-semibold tracking-wide text-canvas dark:bg-surface-2 dark:text-ink"
      role="region"
      aria-label="Info berjalan: stok kritis dan promo"
    >
      <div
        className="ticker-track flex w-max shrink-0 items-center whitespace-nowrap"
        style={{ '--ticker-duration': `${Math.max(18, Math.min(90, Math.round(text.length * 0.55)))}s` } as CSSProperties}
      >
        <span className="px-6">{text}</span>
        <span className="px-6" aria-hidden>{text}</span>
      </div>
    </div>
  )
}
