import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { daysAgoISO, dayStartISO } from '../lib/utils'
import type { Order, Shift, CashMovement, StockMovement, Channel, PaymentMethod, BankAccount, BankTxn } from '../types'

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

export interface ShiftSettlement { shift: Shift; cashSales: number; deposit: number }

/** Rekap setoran per shift yang ditutup pada rentang waktu:
 *  omzet tunai, jumlah disetor ke owner (kas drawer - modal awal),
 *  dan selisih kas (dari hasil hitung fisik saat tutup shift). */
export function useShiftSettlements(range?: { from: string; to: string }) {
  return useQuery({
    queryKey: ['shift-settlements', range?.from, range?.to],
    enabled: !!range,
    queryFn: async (): Promise<ShiftSettlement[]> => {
      let q = supabase.from('shifts').select('*').eq('status', 'closed').order('closed_at', { ascending: false }).limit(60)
      if (range) q = q.gte('closed_at', range.from).lte('closed_at', range.to)
      const { data: shifts, error } = await q
      if (error) throw error
      if (!shifts.length) return []
      const ids = (shifts as Shift[]).map((s) => s.id)
      const { data: ords, error: e2 } = await supabase
        .from('orders')
        .select('shift_id, total, payment_method')
        .in('shift_id', ids)
        .eq('status', 'paid')
      if (e2) throw e2
      const cashBy = new Map<string, number>()
      for (const o of ords as Array<{ shift_id: string | null; total: number; payment_method: string | null }>) {
        if (o.shift_id && o.payment_method === 'cash') cashBy.set(o.shift_id, (cashBy.get(o.shift_id) || 0) + Number(o.total))
      }
      return (shifts as Shift[]).map((s) => ({
        shift: s,
        cashSales: cashBy.get(s.id) || 0,
        deposit: Math.max(0, (s.expected_cash || 0) - (s.opening_float || 0)),
      }))
    },
    staleTime: 30_000,
  })
}

export interface WalletMutation { id: string; kind: 'deposit' | 'income' | 'expense' | 'transfer'; label: string; amount: number; date: string; account: 'wallet' | 'bank'; accountName?: string }

/** Riwayat mutasi wallet: setoran shift, pemasukan lain, pengeluaran.
 *  Dipolling tiap 10 detik untuk efek realtime. */
export function useWalletMutations() {
  return useQuery({
    queryKey: ['wallet-mutations'],
    refetchInterval: 10_000,
    queryFn: async (): Promise<WalletMutation[]> => {
      const [shiftsRes, entriesRes] = await Promise.all([
        supabase.from('shifts').select('id, opening_float, expected_cash, closed_at').eq('status', 'closed').order('closed_at', { ascending: false }).limit(200),
        supabase.from('finance_entries').select('id, type, category, amount, note, entry_date').order('entry_date', { ascending: false }).limit(200),
      ])
      if (shiftsRes.error) throw shiftsRes.error
      if (entriesRes.error) throw entriesRes.error
      const { FINANCE_LABELS } = await import('../lib/constants')
      const items: WalletMutation[] = []
      for (const s of shiftsRes.data as Array<{ id: string; opening_float: number; expected_cash: number | null; closed_at: string | null }>) {
        const dep = Math.max(0, (s.expected_cash || 0) - (s.opening_float || 0))
        if (dep > 0) items.push({ id: `dep-${s.id}`, kind: 'deposit', label: 'Setoran shift dari kas drawer', amount: dep, date: s.closed_at || '', account: 'wallet' })
      }
      for (const e of entriesRes.data as Array<{ id: string; type: string; category: string; amount: number; note: string | null; entry_date: string; account: string | null }>) {
        const isTransfer = (e.note || '').startsWith('Setor ke bank')
        items.push({
          id: `fin-${e.id}`,
          kind: isTransfer ? 'transfer' : e.type === 'income' ? 'income' : 'expense',
          label: `${FINANCE_LABELS[e.category] || e.category}${e.note ? ` · ${e.note}` : ''}`,
          amount: Number(e.amount),
          date: e.entry_date,
          account: e.account === 'bank' ? 'bank' : 'wallet',
        })
      }
      items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      return items.slice(0, 60)
    },
    staleTime: 30_000,
  })
}

/** Tarik dana dari wallet: dicatat otomatis sebagai pengeluaran
 *  sehingga saldo wallet langsung berkurang. */
export function useWalletWithdraw() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { amount: number; note: string | null }) => {
      const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      const { error } = await supabase.from('finance_entries').insert({
        type: 'expense', category: 'lainnya', amount: p.amount,
        note: p.note ? `Tarik dana wallet · ${p.note}` : 'Tarik dana wallet', entry_date: today,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
      qc.invalidateQueries({ queryKey: ['wallet-mutations'] })
    },
  })
}

// ---------- Rekening Bank ----------
export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async (): Promise<BankAccount[]> => {
      const { data, error } = await supabase.from('bank_accounts').select('*').order('created_at')
      if (error) throw error
      return data as BankAccount[]
    },
    staleTime: 60_000,
  })
}

export function useSaveBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (b: Partial<BankAccount> & { name: string }) => {
      const payload = { name: b.name, bank_name: b.bank_name || null, account_no: b.account_no || null, opening_balance: b.opening_balance || 0, is_active: b.is_active ?? true }
      const { error } = b.id
        ? await supabase.from('bank_accounts').update(payload).eq('id', b.id)
        : await supabase.from('bank_accounts').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['bank-balance'] })
    },
  })
}

export function useDeleteBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['bank-balance'] })
    },
  })
}

/** Saldo tiap rekening bank = modal awal + mutasi masuk - mutasi keluar */
export function useBankBalances() {
  return useQuery({
    queryKey: ['bank-balance'],
    queryFn: async () => {
      const [accRes, txnRes] = await Promise.all([
        supabase.from('bank_accounts').select('*').order('created_at'),
        supabase.from('bank_txns').select('account_id, type, amount').limit(2000),
      ])
      if (accRes.error) throw accRes.error
      if (txnRes.error) throw txnRes.error
      const m = new Map<string, number>()
      for (const a of accRes.data as Array<{ id: string; opening_balance: number }>) m.set(a.id, a.opening_balance || 0)
      for (const t of txnRes.data as Array<{ account_id: string; type: string; amount: number }>) {
        m.set(t.account_id, (m.get(t.account_id) || 0) + (t.type === 'in' ? Number(t.amount) : -Number(t.amount)))
      }
      return { accounts: accRes.data as BankAccount[], balances: m }
    },
    staleTime: 30_000,
  })
}

export interface DepositResult { txn: BankTxn; entryId: string }

/** Setor dana wallet → rekening bank: mutasi bank masuk + pengeluaran
 *  di ledger wallet (pindah tempat, tidak mengubah total aset). */
export function useDepositToBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { accountId: string; amount: number; note: string | null }) => {
      const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      const ins = await supabase.from('bank_txns').insert({ account_id: p.accountId, type: 'in', source: 'wallet', amount: p.amount, note: p.note }).select().single()
      if (ins.error) throw ins.error
      const ent = await supabase.from('finance_entries').insert({
        type: 'expense', category: 'lainnya', amount: p.amount,
        note: p.note ? `Setor ke bank · ${p.note}` : 'Setor ke bank',
        entry_date: today, account: 'wallet',
      }).select('id').single()
      if (ent.error) throw ent.error
      return { txn: ins.data as BankTxn, entryId: (ent.data as { id: string }).id }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] })
      qc.invalidateQueries({ queryKey: ['wallet-mutations'] })
      qc.invalidateQueries({ queryKey: ['finance'] })
      qc.invalidateQueries({ queryKey: ['bank-balance'] })
    },
  })
}

/** Mutasi bank manual (masuk/keluar, bukan setoran wallet) */
export function useBankTxn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { accountId: string; type: 'in' | 'out'; amount: number; note: string | null }) => {
      const { error } = await supabase.from('bank_txns').insert({ account_id: p.accountId, type: p.type, amount: p.amount, note: p.note })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-balance'] })
      qc.invalidateQueries({ queryKey: ['bank-txns'] })
    },
  })
}

/** Riwayat mutasi bank terbaru (semua rekening) — polling realtime */
export function useBankTxns() {
  return useQuery({
    queryKey: ['bank-txns'],
    refetchInterval: 10_000,
    queryFn: async (): Promise<Array<BankTxn & { accountName: string }>> => {
      const { data, error } = await supabase
        .from('bank_txns')
        .select('*, account:bank_accounts(name)')
        .order('created_at', { ascending: false })
        .limit(60)
      if (error) throw error
      return (data as Array<any>).map((d) => ({ ...d, accountName: d.account?.name || '—' }))
    },
    staleTime: 15_000,
  })
}

export interface WalletSummary { deposits: number; income: number; expense: number; balance: number; shiftCount: number }

/** Saldo wallet setoran owner (semua waktu):
 *  setoran shift + pemasukan lain - pengeluaran. */
export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: async (): Promise<WalletSummary> => {
      const [shiftsRes, entriesRes] = await Promise.all([
        supabase.from('shifts').select('opening_float, expected_cash').eq('status', 'closed').limit(500),
        // wallet hanya menjumlahkan ledger 'wallet' (transfer ke bank dihitung keluar)
        supabase.from('finance_entries').select('type, amount, account').eq('account', 'wallet').limit(500),
      ])
      if (shiftsRes.error) throw shiftsRes.error
      if (entriesRes.error) throw entriesRes.error
      const closed = shiftsRes.data as Array<{ opening_float: number; expected_cash: number | null }>
      const deposits = closed.reduce((s, x) => s + Math.max(0, (x.expected_cash || 0) - (x.opening_float || 0)), 0)
      let income = 0, expense = 0
      for (const e of entriesRes.data as Array<{ type: string; amount: number }>) {
        if (e.type === 'income') income += Number(e.amount)
        else expense += Number(e.amount)
      }
      return { deposits, income, expense, balance: deposits + income - expense, shiftCount: closed.length }
    },
    staleTime: 30_000,
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
      const { data: sh, error: e0 } = await supabase.from('shifts').select('opening_float').eq('id', shiftId).single()
      if (e0) throw e0
      const { data, error } = await supabase.rpc('close_shift', { p_shift: shiftId, p_counted: counted })
      if (error) throw error
      // catat setoran ke owner (kas drawer - modal awal) sebagai cash out
      // agar riwayat setoran bisa dilacak per shift
      const expected = Number(data) || 0
      const opening = (sh as { opening_float: number } | null)?.opening_float || 0
      const withdraw = Math.max(0, expected - opening)
      if (withdraw > 0) {
        // non-fatal: shift sudah tertutup, kegagalan mencatat setoran tidak membatalkan penutupan
        await supabase
          .from('cash_movements')
          .insert({ shift_id: shiftId, type: 'out', amount: withdraw, note: 'Setoran ke owner' })
      }
      return data as number
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-active'] })
      qc.invalidateQueries({ queryKey: ['shift-history'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['cash-movements'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
      qc.invalidateQueries({ queryKey: ['wallet-mutations'] })
    },
  })
}

export function useDeleteFinanceEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('finance_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
      qc.invalidateQueries({ queryKey: ['wallet-mutations'] })
    },
  })
}

// ---------- Tren saldo gabungan (wallet + bank) ----------
export interface BalancePoint { date: string; balance: number }

/**
 * Net perubahan saldo gabungan (wallet + bank) per tanggal, N hari terakhir.
 * Setoran shift & pemasukan menambah, pengeluaran mengurangi;
 * transfer wallet→bank netral (tidak mengubah saldo gabungan).
 */
export function useBalanceDeltas(days = 30) {
  return useQuery({
    queryKey: ['balance-deltas', days],
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const start = daysAgoISO(days - 1)
      const startTs = dayStartISO(start)
      const [shiftsRes, entriesRes, txnsRes] = await Promise.all([
        supabase.from('shifts').select('expected_cash, opening_float, closed_at').eq('status', 'closed').gte('closed_at', startTs).limit(500),
        supabase.from('finance_entries').select('type, amount, entry_date, note').gte('entry_date', start).limit(500),
        supabase.from('bank_txns').select('type, amount, created_at, source').gte('created_at', startTs).limit(500),
      ])
      if (shiftsRes.error) throw shiftsRes.error
      if (entriesRes.error) throw entriesRes.error
      if (txnsRes.error) throw txnsRes.error
      const net: Record<string, number> = {}
      const add = (date: string, v: number) => { if (date >= start) net[date] = (net[date] || 0) + v }
      // bucket tanggal lokal (closed_at/created_at = UTC)
      const dayKey = (iso: string) => {
        const d = new Date(iso)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      for (const s of shiftsRes.data as Array<{ expected_cash: number | null; opening_float: number; closed_at: string | null }>) {
        if (!s.closed_at) continue
        add(dayKey(s.closed_at), Math.max(0, (s.expected_cash || 0) - (s.opening_float || 0)))
      }
      for (const e of entriesRes.data as Array<{ type: string; amount: number; entry_date: string; note: string | null }>) {
        if ((e.note || '').startsWith('Setor ke bank')) continue // transfer internal: net 0
        add(e.entry_date, e.type === 'income' ? Number(e.amount) : -Number(e.amount))
      }
      for (const t of txnsRes.data as Array<{ type: string; amount: number; created_at: string; source: string | null }>) {
        if (t.source === 'wallet') continue // transfer dari wallet: net 0
        add(dayKey(t.created_at), t.type === 'in' ? Number(t.amount) : -Number(t.amount))
      }
      return net
    },
  })
}

/** Bangun deret saldo harian dengan mundur dari saldo saat ini. */
export function buildBalanceSeries(net: Record<string, number>, current: number, days = 30): BalancePoint[] {
  const out: BalancePoint[] = []
  let bal = current
  for (let i = 0; i < days; i++) {
    const date = daysAgoISO(i)
    out.push({ date, balance: Math.round(bal) })
    bal -= net[date] || 0
  }
  return out.reverse()
}
