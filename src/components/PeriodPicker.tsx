import { useEffect, useRef, useState } from 'react'
import { CalendarRange, Check } from 'lucide-react'
import { todayISO, daysAgoISO, fmtDate } from '../lib/utils'
import { Button, Input, Field } from './ui'

export type Period = 'today' | 'yesterday' | 7 | 30 | 'custom'

/**
 * Pemilih periode ringkas: satu tombol ikon kalender — semua pilihan
 * (pilihan cepat & rentang tanggal bebas) ada di dalam dropdown.
 * Dipakai bersama oleh halaman Dashboard & Keuangan agar tampilan konsisten.
 */
export function PeriodPicker({ period, onPeriod, customFrom, customTo, onCustom }: {
  period: Period
  onPeriod: (p: Period) => void
  customFrom: string
  customTo: string
  onCustom: (from: string, to: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(customFrom)
  const [to, setTo] = useState(customTo)
  // offset horizontal panel relatif tombol (dihitung saat dibuka agar selalu muat di layar)
  const [panelX, setPanelX] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const toggle = () => {
    if (!open && boxRef.current) {
      // pusatkan panel pada tombol, lalu jepit supaya tidak keluar viewport
      const r = boxRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const w = Math.min(320, vw - 32)
      const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, vw - 8 - w))
      setPanelX(Math.round(x - r.left))
    }
    setOpen((v) => !v)
  }

  // ikuti nilai terbaru dari parent (mis. preset dipilih dari luar)
  useEffect(() => { setFrom(customFrom); setTo(customTo) }, [customFrom, customTo])

  // tutup dropdown saat klik/sentuh di luar kotak
  useEffect(() => {
    if (!open) return
    const h = (e: PointerEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [open])

  // pilihan cepat: 4 preset memetakan periode bawaan, "Bulan ini" memakai rentang khusus
  const quick: Array<{ label: string; active: boolean; run: () => void }> = [
    { label: 'Hari ini', active: period === 'today', run: () => onPeriod('today') },
    { label: 'Kemarin', active: period === 'yesterday', run: () => onPeriod('yesterday') },
    { label: '7 hari terakhir', active: period === 7, run: () => onPeriod(7) },
    { label: '30 hari terakhir', active: period === 30, run: () => onPeriod(30) },
    { label: 'Bulan ini', active: false, run: () => onCustom(todayISO().slice(0, 8) + '01', todayISO()) },
  ]

  return (
    <div ref={boxRef} className="flex items-center gap-2">
      <div className="relative shrink-0">
        <button
          onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
          aria-label="Pilih periode laporan" title="Pilih periode laporan"
          className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
            period === 'custom'
              ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
          }`}
        >
          <CalendarRange size={18} aria-hidden />
        </button>

        {open && (
          <div
            style={{ left: panelX }}
            className="absolute top-[calc(100%+6px)] z-40 w-[min(20rem,calc(100vw-2.5rem))] space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-pop dark:border-slate-800 dark:bg-slate-900"
            role="dialog" aria-label="Pilih periode laporan"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pilihan cepat</p>
            <div className="space-y-0.5" role="listbox" aria-label="Pilihan cepat periode">
              {quick.map((q) => (
                <button
                  key={q.label} role="option" aria-selected={q.active}
                  onClick={() => { q.run(); setOpen(false) }}
                  className={`flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm font-semibold transition-colors ${
                    q.active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {q.label}
                  {q.active && <Check size={15} aria-hidden />}
                </button>
              ))}
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Rentang khusus</p>
              {period === 'custom' && (
                <p className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  Aktif: {fmtDate(customFrom)} – {fmtDate(customTo)}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Dari"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
                <Field label="Sampai"><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
              </div>
              <Button className="w-full" disabled={!from || !to} onClick={() => { onCustom(from, to); setOpen(false) }}>
                Terapkan
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
