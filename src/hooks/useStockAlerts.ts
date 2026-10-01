import { useEffect, useRef } from 'react'
import { useIngredients } from './useMaster'
import { toast } from '../lib/toast'
import { fmtQty } from '../lib/utils'

/**
 * Peringatan global (toast) saat bahan dengan opsi notifikasi aktif
 * mencapai / di bawah stok minimum. Dipasang sekali di Layout agar
 * berlaku di semua halaman — termasuk setelah transaksi kasir.
 */
export function useStockAlerts() {
  const { data: ingredients = [] } = useIngredients()
  // bahan yang sudah diperingatkan; dihapus dari set saat stok kembali aman
  const alerted = useRef<Set<string>>(new Set())

  useEffect(() => {
    const newlyLow: string[] = []
    for (const i of ingredients) {
      if (!i.is_active) continue
      const low = i.stock <= i.min_stock
      if (!i.low_stock_alert || !low) {
        alerted.current.delete(i.id)
        continue
      }
      if (!alerted.current.has(i.id)) {
        alerted.current.add(i.id)
        newlyLow.push(`${i.name} (${fmtQty(i.stock)} ${i.unit})`)
      }
    }
    if (newlyLow.length) {
      const shown = newlyLow.slice(0, 3).join(', ')
      const extra = newlyLow.length > 3 ? ` +${newlyLow.length - 3} lainnya` : ''
      toast.info(`Stok menipis: ${shown}${extra}`)
    }
  }, [ingredients])
}
