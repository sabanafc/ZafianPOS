import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { DEFAULT_WINDOW_DAYS, type UsageStat } from '../lib/purchasing'
import type { Purchase } from '../types'

/** Riwayat nota pembelian bahan (terbaru dulu) beserta rinciannya. */
export function usePurchases(limit = 60) {
  return useQuery({
    queryKey: ['purchases', limit],
    queryFn: async (): Promise<Purchase[]> => {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, items:purchase_items(*, ingredient:ingredients(name, unit))')
        .order('purchased_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as unknown as Purchase[]
    },
    staleTime: 30_000,
  })
}

export interface PurchaseInput {
  supplier: string | null
  note: string | null
  items: Array<{
    ingredient_id: string
    qty: number          // satuan resep
    unit_cost: number    // harga per satuan resep
    purchase_unit?: string | null
    purchase_qty?: number | null
    purchase_price?: number | null
  }>
}

/** Catat pembelian: stok bertambah, HPP rata-rata diperbarui, riwayat tercatat. */
export function useSavePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: PurchaseInput): Promise<string> => {
      const { data, error } = await supabase.rpc('create_purchase', {
        p_supplier: p.supplier,
        p_note: p.note,
        p_items: p.items,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['stock-movements'] })
      qc.invalidateQueries({ queryKey: ['ingredient-usage'] })
    },
  })
}

/**
 * Rata-rata pemakaian bahan per hari, diturunkan dari riwayat stok bertipe
 * 'usage' (tercatat otomatis saat transaksi dibayar). Hanya memakai jendela
 * `days` hari terakhir.
 */
export function useIngredientUsage(days = DEFAULT_WINDOW_DAYS) {
  return useQuery({
    queryKey: ['ingredient-usage', days],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, UsageStat>> => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString()
      const { data, error } = await supabase
        .from('stock_movements')
        .select('ingredient_id, qty, created_at')
        .eq('type', 'usage')
        .gte('created_at', since)
        .limit(5000)
      if (error) throw error
      const totals = new Map<string, number>()
      const daySets = new Map<string, Set<string>>()
      for (const m of data as Array<{ ingredient_id: string; qty: number; created_at: string }>) {
        totals.set(m.ingredient_id, (totals.get(m.ingredient_id) || 0) + Math.abs(Number(m.qty)))
        if (!daySets.has(m.ingredient_id)) daySets.set(m.ingredient_id, new Set())
        daySets.get(m.ingredient_id)!.add(m.created_at.slice(0, 10))
      }
      const out: Record<string, UsageStat> = {}
      for (const [id, total] of totals) {
        out[id] = { total, activeDays: daySets.get(id)?.size || 0, windowDays: days }
      }
      return out
    },
  })
}
