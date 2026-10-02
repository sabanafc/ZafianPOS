import { useMemo, useState } from 'react'
import { Wallet, Receipt, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, ArrowUpRight, ArrowDownRight, Minus, Clock, Tags, CreditCard, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOrders, useFinanceEntries, useShiftHistory } from '../hooks/useOrders'
import { useIngredients, useCategories, useProducts } from '../hooks/useMaster'
import { useSettings } from '../hooks/useSettings'
import { Page, Card, Badge, Spinner } from '../components/ui'
import { PeriodPicker, type Period } from '../components/PeriodPicker'
import { fmtID, fmtIDShort, fmtQty, fmtDateTime, dayStartISO, dayEndISO, todayISO, daysAgoISO } from '../lib/utils'
import { CHANNELS, PAYMENTS } from '../lib/constants'
import type { Order } from '../types'

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>(7)
  const [selIdx, setSelIdx] = useState<number | null>(null)
  const [customFrom, setCustomFrom] = useState(() => daysAgoISO(6))
  const [customTo, setCustomTo] = useState(() => todayISO())
  const changePeriod = (p: Period) => { setPeriod(p); setSelIdx(null) }
  const applyCustom = (a: string, b: string) => {
    setCustomFrom(a); setCustomTo(b); setPeriod('custom'); setSelIdx(null)
  }
  const today = todayISO()
  const { settings } = useSettings()

  // Rentang periode aktif & periode pembanding sebelumnya
  const { from, to, label, prevFrom, prevTo, prevLabel } = useMemo(() => {
    if (period === 'today') {
      return { from: dayStartISO(today), to: dayEndISO(today), label: 'Hari ini', prevFrom: dayStartISO(daysAgoISO(1)), prevTo: dayEndISO(daysAgoISO(1)), prevLabel: 'Kemarin' }
    }
    if (period === 'yesterday') {
      const y = daysAgoISO(1), y2 = daysAgoISO(2)
      return { from: dayStartISO(y), to: dayEndISO(y), label: 'Kemarin', prevFrom: dayStartISO(y2), prevTo: dayEndISO(y2), prevLabel: '2 hari lalu' }
    }
    if (period === 'custom') {
      const a = (customFrom || today), b = (customTo || today)
      const s = a <= b ? a : b, e = a <= b ? b : a
      const days = Math.max(1, Math.round((Date.parse(e + 'T00:00:00') - Date.parse(s + 'T00:00:00')) / 86400000) + 1)
      const pEnd = daysAgoISO(days), pStart = daysAgoISO(2 * days - 1)
      return { from: dayStartISO(s), to: dayEndISO(e), label: `${days} hari`, prevFrom: dayStartISO(pStart), prevTo: dayEndISO(pEnd), prevLabel: `${days} hari sebelumnya` }
    }
    const n = period as number
    return {
      from: dayStartISO(daysAgoISO(n - 1)), to: dayEndISO(today), label: `${n} hari`,
      prevFrom: dayStartISO(daysAgoISO(2 * n - 1)), prevTo: dayEndISO(daysAgoISO(n)), prevLabel: `${n} hari sebelumnya`,
    }
  }, [period, today, customFrom, customTo])

  const { data: orders = [], isLoading } = useOrders({ from, to })
  const { data: prevOrders = [] } = useOrders({ from: prevFrom, to: prevTo })
  const { data: ingredients = [] } = useIngredients()
  const { data: categories = [] } = useCategories()
  const { data: allProducts = [] } = useProducts()
  const { data: finance = [] } = useFinanceEntries({ from: from.slice(0, 10), to: to.slice(0, 10) })
  const { data: shifts = [] } = useShiftHistory()

  const paid = useMemo(() => orders.filter((o) => o.status === 'paid'), [orders])
  const prevPaid = useMemo(() => prevOrders.filter((o) => o.status === 'paid'), [prevOrders])

  const revenue = paid.reduce((s, o) => s + o.total, 0)
  const cogs = paid.reduce((s, o) => s + o.cost_total, 0)
  const expenses = finance.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0)
  const profit = revenue - cogs - expenses
  const trxCount = paid.length
  const avg = trxCount ? Math.round(revenue / trxCount) : 0
  const itemsSold = paid.reduce((s, o) => s + (o.items || []).reduce((x, i) => x + i.qty, 0), 0)
  const discountGiven = paid.reduce((s, o) => s + o.discount, 0)

  const prevRevenue = prevPaid.reduce((s, o) => s + o.total, 0)
  const prevTrx = prevPaid.length
  const prevProfit = prevPaid.reduce((s, o) => s + o.total - o.cost_total, 0) - expenses

  const pct = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0
    return Math.round(((cur - prev) / prev) * 100)
  }
  const revPct = pct(revenue, prevRevenue)
  const trnPct = pct(trxCount, prevTrx)
  const prfPct = pct(profit, prevProfit)

  // Grafik dinamis + perbandingan periode sebelumnya:
  // per jam (hari ini/kemarin), per hari (7 hari), per minggu (30 hari)
  const chart = useMemo(() => {
    const hourMode = period === 'today' || period === 'yesterday'
    const start = from.slice(0, 10), end = to.slice(0, 10)
    const dayCount = Math.round((Date.parse(end + 'T00:00:00') - Date.parse(start + 'T00:00:00')) / 86400000) + 1
    // per jam (hari ini/kemarin), per hari (≤14 hari), per minggu (lebih dari itu)
    const weekMode = !hourMode && dayCount > 14
    const unit = hourMode ? 'jam' : weekMode ? 'minggu' : 'hari'
    const count = hourMode ? 24 : weekMode ? Math.ceil(dayCount / 7) : dayCount

    const buckets = (n: number) => Array.from({ length: n }, () => ({ value: 0, trx: 0, items: 0 }))
    const fill = (orders: Order[], baseMs: number) => {
      const arr = buckets(count)
      for (const o of orders) {
        let idx: number
        if (hourMode) idx = new Date(o.created_at).getHours()
        else {
          const off = Math.floor((Date.parse(o.created_at.slice(0, 10) + 'T00:00:00') - baseMs) / 86400000)
          idx = weekMode ? Math.floor(off / 7) : off
        }
        if (idx >= 0 && idx < count) {
          arr[idx].value += o.total
          arr[idx].trx += 1
          arr[idx].items += (o.items || []).reduce((s, i) => s + i.qty, 0)
        }
      }
      return arr
    }

    const labels: string[] = []
    if (hourMode) {
      for (let h = 0; h < 24; h++) labels.push(String(h).padStart(2, '0'))
    } else {
      const base = new Date(start + 'T00:00:00')
      for (let i = 0; i < count; i++) {
        const d = new Date(base)
        d.setDate(d.getDate() + i * (weekMode ? 7 : 1))
        labels.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10))
      }
    }

    return {
      labels,
      unit,
      cur: fill(paid, Date.parse(start + 'T00:00:00')),
      prev: fill(prevPaid, Date.parse(prevFrom.slice(0, 10) + 'T00:00:00')),
    }
  }, [paid, prevPaid, from, to, prevFrom, period])
  const unit = chart.unit
  const maxVal = Math.max(1, ...chart.cur.map((b) => b.value), ...chart.prev.map((b) => b.value))

  // channel breakdown
  const byChannel = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>()
    for (const o of paid) {
      const cur = m.get(o.channel) || { total: 0, count: 0 }
      m.set(o.channel, { total: cur.total + o.total, count: cur.count + 1 })
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total)
  }, [paid])

  // metode bayar
  const byPayment = useMemo(() => {
    const m: Record<string, number> = { cash: 0, qris: 0, transfer: 0 }
    for (const o of paid) if (o.payment_method) m[o.payment_method] = (m[o.payment_method] || 0) + o.total
    return m
  }, [paid])

  // produk & kategori terlaris
  const topProducts = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; total: number }>()
    for (const o of paid) for (const it of o.items || []) {
      const cur = m.get(it.name) || { name: it.name, qty: 0, total: 0 }
      m.set(it.name, { name: it.name, qty: cur.qty + it.qty, total: cur.total + it.line_total })
    }
    return Array.from(m.values()).sort((a, b) => b.qty - a.qty).slice(0, 6)
  }, [paid])

  // map produk → kategori (dihitung sebelum dipakai di byCategory)
  const productCatMap = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const p of allProducts) m.set(p.id, p.category_id)
    return m
  }, [allProducts])

  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of paid) {
      for (const it of o.items || []) {
        const catId = productCatMap.get(it.product_id || '') || null
        const catName = categories.find((c) => c.id === catId)?.name || 'Tanpa kategori'
        m.set(catName, (m.get(catName) || 0) + it.line_total)
      }
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [paid, categories, productCatMap])

  // jam sibuk
  const byHour = useMemo(() => {
    const m = new Map<number, { total: number; count: number }>()
    for (const o of paid) {
      const h = new Date(o.created_at).getHours()
      const cur = m.get(h) || { total: 0, count: 0 }
      m.set(h, { total: cur.total + o.total, count: cur.count + 1 })
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, 3)
  }, [paid])

  const lowStock = ingredients.filter((i) => i.stock <= i.min_stock).slice(0, 5)
  const lastClosedShift = shifts.find((s) => s.status === 'closed')

  return (
    <Page title="Dashboard" actions={
      <PeriodPicker period={period} onPeriod={changePeriod} customFrom={customFrom} customTo={customTo} onCustom={applyCustom} />
    }>
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          {/* Kartu ringkasan dengan perbandingan */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat icon={<Wallet size={18} aria-hidden />} label={`Omzet · ${label}`} value={fmtIDShort(revenue)} delta={revPct} sub={`vs ${prevLabel}: ${fmtIDShort(prevRevenue)}`} tone="brand" />
            <Stat icon={<Receipt size={18} aria-hidden />} label="Transaksi" value={String(trxCount)} delta={trnPct} sub={`Rata-rata ${fmtIDShort(avg)} · ${itemsSold} item`} />
            <Stat icon={<TrendingUp size={18} aria-hidden />} label="Estimasi laba" value={fmtIDShort(profit)} delta={prfPct} sub={`Bahan ${fmtIDShort(cogs)} · Beban ${fmtIDShort(expenses)}`} tone={profit >= 0 ? 'green' : 'red'} />
            <Stat icon={<TrendingDown size={18} aria-hidden />} label="HPP bahan" value={fmtIDShort(cogs)} sub={`${revenue > 0 ? Math.round((cogs / revenue) * 100) : 0}% dari omzet · diskon ${fmtIDShort(discountGiven)}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Grafik */}
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold">
                  Penjualan {label.toLowerCase()} <span className="font-medium text-slate-400 dark:text-slate-500">· per {unit}</span>
                </h2>
                <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-brand-500" aria-hidden /> {label}</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-300 dark:bg-slate-600" aria-hidden /> {prevLabel}</span>
                </div>
              </div>

              {/* Detail ketuk batang: omzet, transaksi, item + pembanding periode lalu */}
              {selIdx !== null && (() => {
                const c = chart.cur[selIdx], p = chart.prev[selIdx]
                const k = chart.labels[selIdx]
                const title = unit === 'jam'
                  ? `${k}:00–${(Number(k) + 1) % 24}:00`
                  : `${unit === 'minggu' ? 'Minggu' : 'Tanggal'} ${k.slice(8)}/${k.slice(5, 7)}`
                return (
                  <div className="mb-2.5 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800" role="status" aria-live="polite">
                    <p className="font-bold">{title}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-slate-600 dark:text-slate-300">
                      <span>Omzet <strong className="tabular-nums">{fmtID(c.value)}</strong></span>
                      <span>{c.trx} transaksi</span>
                      <span>{c.items} item</span>
                    </p>
                    {p.value > 0 && (
                      <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                        {prevLabel} — omzet <strong className="tabular-nums">{fmtID(p.value)}</strong> · {p.trx} transaksi
                      </p>
                    )}
                  </div>
                )
              })()}

              <div className="flex h-40 items-stretch gap-1.5" role="img" aria-label={`Grafik penjualan ${label} per ${unit}, dibandingkan ${prevLabel}`}>
                {chart.labels.map((k, i) => {
                  const c = chart.cur[i], p = chart.prev[i]
                  const sel = selIdx === i
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelIdx(sel ? null : i)}
                      aria-label={`${unit === 'jam' ? `Jam ${k}` : `Tanggal ${k.slice(8)}/${k.slice(5, 7)}`}: omzet ${fmtID(c.value)}, ${c.trx} transaksi, ${c.items} item`}
                      className={`group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 pt-1 ${sel ? 'bg-brand-50 dark:bg-slate-800' : ''}`}
                    >
                      <span className="h-3 text-[9px] font-semibold tabular-nums text-slate-400 opacity-0 group-hover:opacity-100">{c.value > 0 ? fmtIDShort(c.value).replace('Rp ', '') : ''}</span>
                      <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-[2px]">
                        <div
                          className={`w-full max-w-[13px] rounded-t-md transition-colors ${sel ? 'bg-brand-700 dark:bg-brand-400' : 'bg-brand-500 group-hover:bg-brand-600 dark:bg-brand-600'}`}
                          style={{ height: `${Math.max(3, (c.value / maxVal) * 100)}%` }}
                        />
                        <div
                          className="w-full max-w-[13px] rounded-t-md bg-slate-300 group-hover:bg-slate-400 dark:bg-slate-600"
                          style={{ height: `${Math.max(3, (p.value / maxVal) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400">{unit === 'jam' ? k : `${k.slice(8)}/${k.slice(5, 7)}`}</span>
                    </button>
                  )
                })}
              </div>
            </Card>

            {/* Channel */}
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-bold">Omzet per channel</h2>
              {byChannel.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Belum ada transaksi pada periode ini.</p>
              ) : (
                <ul className="space-y-2.5">
                  {byChannel.map(([ch, v]) => {
                    const meta = CHANNELS.find((c) => c.id === ch)
                    const share = revenue ? Math.round((v.total / revenue) * 100) : 0
                    return (
                      <li key={ch}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 font-semibold">
                            {meta && <meta.icon size={15} style={{ color: meta.color }} aria-hidden />}
                            {meta?.label || ch}
                          </span>
                          <span className="tabular-nums">{fmtID(v.total)} <span className="text-xs text-slate-400">· {v.count} trx · {share}%</span></span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full" style={{ width: `${share}%`, background: meta?.color || '#6366f1' }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            {/* Produk terlaris */}
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-bold">Produk terlaris</h2>
              {topProducts.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Belum ada penjualan.</p>
              ) : (
                <ol className="space-y-2">
                  {topProducts.map((p, i) => (
                    <li key={p.name} className="flex items-center gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" aria-hidden>{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{p.qty}x · {fmtIDShort(p.total)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            {/* Metode bayar */}
            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold"><CreditCard size={15} aria-hidden /> Metode pembayaran</h2>
              <ul className="space-y-2.5">
                {PAYMENTS.map((p) => {
                  const val = byPayment[p.id] || 0
                  const share = revenue ? Math.round((val / revenue) * 100) : 0
                  return (
                    <li key={p.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 font-semibold"><p.icon size={15} style={{ color: p.color }} aria-hidden /> {p.label}</span>
                        <span className="tabular-nums">{fmtID(val)} <span className="text-xs text-slate-400">{share}%</span></span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: p.color }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>

            {/* Kategori terlaris */}
            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Tags size={15} aria-hidden /> Omzet per kategori</h2>
              {byCategory.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Belum ada penjualan.</p>
              ) : (
                <ul className="space-y-2">
                  {byCategory.map(([cat, val]) => (
                    <li key={cat} className="flex items-center justify-between text-sm">
                      <span className="min-w-0 truncate font-medium">{cat}</span>
                      <span className="shrink-0 font-bold tabular-nums">{fmtIDShort(val)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Jam sibuk */}
            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Clock size={15} aria-hidden /> Jam tersibuk</h2>
              {byHour.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Belum ada data jam.</p>
              ) : (
                <ul className="space-y-2">
                  {byHour.map(([h, v]) => (
                    <li key={h} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{String(h).padStart(2, '0')}:00–{String((h + 1) % 24).padStart(2, '0')}:00</span>
                      <span className="text-xs text-slate-500">{v.count} trx · {fmtIDShort(v.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Stok kritis */}
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold"><AlertTriangle size={15} className="text-amber-500" aria-hidden /> Stok kritis</h2>
                <Link to="/bahan" className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">Kelola <ArrowRight size={12} aria-hidden /></Link>
              </div>
              {lowStock.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Semua stok aman. 👍</p>
              ) : (
                <ul className="space-y-2">
                  {lowStock.map((i) => (
                    <li key={i.id} className="flex items-center justify-between text-sm">
                      <span className="min-w-0 truncate font-medium">{i.name}</span>
                      <span className="shrink-0 font-bold tabular-nums text-red-600">{fmtQty(i.stock)} {i.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Shift terakhir */}
            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Lock size={15} aria-hidden /> Shift terakhir ditutup</h2>
              {lastClosedShift ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Ditutup</span><span className="font-semibold">{fmtDateTime(lastClosedShift.closed_at!)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Kas diharapkan</span><span className="font-bold tabular-nums">{fmtID(lastClosedShift.expected_cash || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Kas dihitung</span><span className="font-bold tabular-nums">{fmtID(lastClosedShift.counted_cash || 0)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Selisih</span>
                    <Badge tone={Math.abs(lastClosedShift.cash_diff || 0) < 1 ? 'green' : (lastClosedShift.cash_diff || 0) > 0 ? 'amber' : 'red'}>
                      {(lastClosedShift.cash_diff || 0) > 0 ? '+' : ''}{fmtID(lastClosedShift.cash_diff || 0)}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">Belum ada shift yang ditutup.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </Page>
  )
}

function Stat({ icon, label, value, delta, sub, tone }: { icon: React.ReactNode; label: string; value: string; delta?: number; sub?: string; tone?: 'brand' | 'green' | 'red' }) {
  const tones = {
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  const Delta = () => {
    if (delta === undefined) return null
    const up = delta > 0, flat = delta === 0
    const cls = flat ? 'text-slate-500' : up ? 'text-green-700 dark:text-green-400' : 'text-red-600'
    const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${cls}`} aria-label={`${up ? 'Naik' : flat ? 'Tetap' : 'Turun'} ${Math.abs(delta)}% dibanding periode sebelumnya`}>
        <Icon size={13} aria-hidden />{Math.abs(delta)}%
      </span>
    )
  }
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone || 'brand']}`} aria-hidden>{icon}</div>
        <Delta />
      </div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums md:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
    </Card>
  )
}


