import { useMemo, useState } from 'react'
import { Wallet, Receipt, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, ArrowUpRight, ArrowDownRight, Minus, Clock, Tags, CreditCard, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOrders, useFinanceEntries, useShiftHistory } from '../hooks/useOrders'
import { useIngredients, useCategories, useProducts } from '../hooks/useMaster'
import { useSettings } from '../hooks/useSettings'
import { Page, Card, Badge, Spinner } from '../components/ui'
import { fmtID, fmtIDShort, fmtQty, fmtDateTime, dayStartISO, dayEndISO, todayISO, daysAgoISO } from '../lib/utils'
import { CHANNELS, PAYMENTS } from '../lib/constants'
import type { Order } from '../types'

type Period = 'today' | 'yesterday' | 7 | 30

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>(7)
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
    const n = period as number
    return {
      from: dayStartISO(daysAgoISO(n - 1)), to: dayEndISO(today), label: `${n} hari`,
      prevFrom: dayStartISO(daysAgoISO(2 * n - 1)), prevTo: dayEndISO(daysAgoISO(n)), prevLabel: `${n} hari sebelumnya`,
    }
  }, [period, today])

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

  // Grafik dinamis: per jam (hari ini/kemarin), per hari (7 hari), per minggu (30 hari)
  const chart = useMemo<Array<[string, number]>>(() => {
    if (period === 'today' || period === 'yesterday') {
      const byHour = new Map<number, number>()
      for (let h = 0; h < 24; h++) byHour.set(h, 0)
      for (const o of paid) {
        const h = new Date(o.created_at).getHours()
        byHour.set(h, (byHour.get(h) || 0) + o.total)
      }
      return Array.from(byHour.entries()).map(([h, v]) => [String(h).padStart(2, '0'), v] as [string, number])
    }
    const byDay = new Map<string, number>()
    for (const o of paid) byDay.set(o.created_at.slice(0, 10), (byDay.get(o.created_at.slice(0, 10)) || 0) + o.total)
    const start = from.slice(0, 10), end = to.slice(0, 10)
    const days: string[] = []
    let d = new Date(start)
    const endD = new Date(end)
    while (d <= endD) {
      const tz = d.getTimezoneOffset()
      days.push(new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }
    if ((period as number) <= 7) {
      return days.map((k) => [k, byDay.get(k) || 0] as [string, number])
    }
    // 30 hari → per minggu (7 hari per batang)
    const weeks: Array<[string, number]> = []
    days.forEach((k, i) => {
      if (i % 7 === 0) weeks.push([k, 0])
      weeks[weeks.length - 1][1] += byDay.get(k) || 0
    })
    return weeks
  }, [paid, from, to, period])
  const unit = period === 'today' || period === 'yesterday' ? 'jam' : (period as number) <= 7 ? 'hari' : 'minggu'
  const maxVal = Math.max(1, ...chart.map(([, v]) => v))

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
    <Page title="Dashboard" actions={<RangePicker period={period} setPeriod={setPeriod} />}>
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
              <h2 className="mb-3 text-sm font-bold">Penjualan {label.toLowerCase()} <span className="font-medium text-slate-400 dark:text-slate-500">· per {unit}</span></h2>
              <div className="flex h-40 items-end gap-1.5" role="img" aria-label={`Grafik penjualan ${label} per ${unit}`}>
                {chart.map(([k, v]) => (
                  <div key={k} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span className="text-[9px] font-semibold tabular-nums text-slate-400 opacity-0 group-hover:opacity-100">{v > 0 ? fmtIDShort(v).replace('Rp ', '') : ''}</span>
                    <div className="w-full rounded-t-md bg-brand-500 transition-all group-hover:bg-brand-600 dark:bg-brand-600" style={{ height: `${Math.max(3, (v / maxVal) * 100)}%` }} />
                    <span className="text-[9px] text-slate-400">{unit === 'jam' ? k : `${k.slice(8)}/${k.slice(5, 7)}`}</span>
                  </div>
                ))}
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

function RangePicker({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void }) {
  const opts: Array<{ id: Period; label: string }> = [
    { id: 'today', label: 'Hari ini' },
    { id: 'yesterday', label: 'Kemarin' },
    { id: 7, label: '7 hari' },
    { id: 30, label: '30 hari' },
  ]
  return (
    <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label="Periode laporan">
      {opts.map((o) => (
        <button
          key={String(o.id)} role="radio" aria-checked={period === o.id} onClick={() => setPeriod(o.id)}
          className={`h-9 rounded-lg px-3 text-sm font-semibold ${period === o.id ? 'bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white' : 'text-slate-500'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
