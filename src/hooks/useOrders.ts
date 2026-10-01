import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Order, Shift, CashMovement, StockMovement, Channel, PaymentMethod } from '../types'

// ---------- Orders ----------
export function useOrders(range?: { from: string; to: string }) {
  return useQuery({
    queryKey: ['orders', range?.from, range?.to],
    enabled: !!range,
    queryFn: async (): Promise<Order[]> => {
      let q = supabase.from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false })
      if (range) q = q.gte('created_at', range.from).lte('created_at', range.to)
      const { data, error } = await q
      if (error) throw error
      return data as unknown as Order[]
    },
  })
}

export function useOrderHistory(limit = 50) {
  return useQuery({
    queryKey: ['orders', 'history', limit],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as unknown as Order[]
    },
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      channel: Channel; items: Array<{ productId: string; qty: number }>; discount: number
      payment: PaymentMethod | null; paid: number | null; note: string | null; shiftId: string | null
    }) => {
      const { data, error } = await supabase.rpc('create_order', {
        p_channel: p.channel,
        p_items: p.items,
        p_discount: p.discount,
        p_payment: p.payment,
        p_paid: p.paid,
        p_note: p.note,
        p_shift: p.shiftId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['stock-movements'] })
      qc.invalidateQueries({ queryKey: ['shift-active'] })
    },
  })
}

export function useVoidOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orders').update({ status: 'void' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['shift-active'] })
    },
  })
}

// ---------- Shift ----------
export function useActiveShift() {
  return useQuery({
    queryKey: ['shift-active'],
    queryFn: async (): Promise<Shift | null> => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data as Shift) || null
    },
    staleTime: 10_000,
  })
}

export function useShiftHistory() {
  return useQuery({
    queryKey: ['shift-history'],
    queryFn: async (): Promise<Shift[]> => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data as Shift[]
    },
  })
}

/** Semua order untuk ekspor (tanpa batas waktu) */
export function useOrdersAll() {
  return useQuery({
    queryKey: ['orders', 'all'],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data as unknown as Order[]
    },
  })
}

export function useOpenShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (openingFloat: number) => {
      const { data, error } = await supabase
        .from('shifts')
        .insert({ opening_float: openingFloat, status: 'open' })
        .select()
        .single()
      if (error) throw error
      return data as Shift
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-active'] }),
  })
}

export function useCloseShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ shiftId, counted }: { shiftId: string; counted: number }) => {
      const { data, error } = await supabase.rpc('close_shift', { p_shift: shiftId, p_counted: counted })
      if (error) throw error
      return data as number
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-active'] })
      qc.invalidateQueries({ queryKey: ['shift-history'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useShiftCash(shiftId?: string | null) {
  return useQuery({
    queryKey: ['cash-movements', shiftId],
    enabled: !!shiftId,
    queryFn: async (): Promise<CashMovement[]> => {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('shift_id', shiftId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as CashMovement[]
    },
  })
}

export function useAddCashMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (m: { shift_id: string; type: 'in' | 'out'; amount: number; note: string | null }) => {
      const { error } = await supabase.from('cash_movements').insert(m)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-movements'] })
      qc.invalidateQueries({ queryKey: ['shift-active'] })
      // penting: ringkasan kas di drawer ikut diperbarui
      qc.invalidateQueries({ queryKey: ['shift-summary'] })
      qc.removeQueries({ predicate: (q) => q.queryKey[0] === 'shift-summary' })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/** Ringkasan kas shift aktif: penjualan cash, cash in/out */
export function useShiftSummary(shiftId?: string | null) {
  return useQuery({
    queryKey: ['shift-summary', shiftId],
    enabled: !!shiftId,
    queryFn: async () => {
      const [ordersRes, cashRes] = await Promise.all([
        supabase
          .from('orders')
          .select('total, payment_method, status')
          .eq('shift_id', shiftId!)
          .eq('status', 'paid'),
        supabase.from('cash_movements').select('type, amount').eq('shift_id', shiftId!),
      ])
      if (ordersRes.error) throw ordersRes.error
      if (cashRes.error) throw cashRes.error
      const orders = ordersRes.data as Array<{ total: number; payment_method: string | null; status: string }>
      const cashIn = cashRes.data.filter((c: any) => c.type === 'in').reduce((s: number, c: any) => s + Number(c.amount), 0)
      const cashOut = cashRes.data.filter((c: any) => c.type === 'out').reduce((s: number, c: any) => s + Number(c.amount), 0)
      const cashSales = orders.filter((o) => o.payment_method === 'cash').reduce((s, o) => s + Number(o.total), 0)
      return { cashSales, cashIn, cashOut }
    },
  })
}

// ---------- Stok ----------
export function useStockMovements(ingredientId?: string) {
  return useQuery({
    queryKey: ['stock-movements', ingredientId],
    queryFn: async (): Promise<StockMovement[]> => {
      let q = supabase
        .from('stock_movements')
        .select('*, ingredient:ingredients(name, unit)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (ingredientId) q = q.eq('ingredient_id', ingredientId)
      const { data, error } = await q
      if (error) throw error
      return data as unknown as StockMovement[]
    },
  })
}

// ---------- Keuangan ----------
export function useFinanceEntries(range?: { from: string; to: string }) {
  return useQuery({
    queryKey: ['finance', range?.from, range?.to],
    queryFn: async () => {
      let q = supabase.from('finance_entries').select('*').order('entry_date', { ascending: false })
      if (range) q = q.gte('entry_date', range.from).lte('entry_date', range.to)
      const { data, error } = await q
      if (error) throw error
      return data as import('../types').FinanceEntry[]
    },
  })
}

export function useSaveFinanceEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (e: { id?: string; type: 'income' | 'expense'; category: string; amount: number; note: string | null; entry_date: string }) => {
      const { error } = e.id
        ? await supabase.from('finance_entries').update(e).eq('id', e.id)
        : await supabase.from('finance_entries').insert(e)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}

export function useDeleteFinanceEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('finance_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}
