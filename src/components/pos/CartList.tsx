import { Minus, Plus, Trash2, Tag, PauseCircle, Play, XCircle, PlusCircle } from 'lucide-react'
import type { CartLine, HeldOrder } from '../../store/pos'
import type { Settings } from '../../types'
import { fmtID } from '../../lib/utils'
import { calcTotals } from '../../lib/posCalc'
import { IconButton, Input } from '../ui'

interface Props {
  lines: CartLine[]
  discount: number
  settings?: Settings | null
  held?: HeldOrder[]
  online?: boolean
  onQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onDiscount: (d: number) => void
  onHold?: () => void
  onResumeHold?: (id: string) => void
  onDeleteHold?: (id: string) => void
}

export function CartList({ lines, discount, settings, held = [], online, onQty, onRemove, onDiscount, onHold, onResumeHold, onDeleteHold }: Props) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const t = calcTotals(subtotal, discount, settings)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800" aria-hidden>
            <Tag size={22} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Keranjang kosong.<br />Pilih menu untuk mulai.</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2" aria-label="Item keranjang">
          {lines.map((l) => (
            <li key={l.productId} className="rounded-xl border border-slate-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-[15px] font-bold leading-snug">{l.name}</p>
                <p className="shrink-0 text-[15px] font-bold tabular-nums text-brand-700 dark:text-brand-300">{fmtID(l.price * l.qty)}</p>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{fmtID(l.price)} × {l.qty}</p>
                <div className="flex items-center gap-1">
                  <IconButton label={`Kurangi ${l.name}`} variant="secondary" size="sm" onClick={() => onQty(l.productId, l.qty - 1)}>
                    <Minus size={14} aria-hidden />
                  </IconButton>
                  <span className="w-8 text-center text-base font-bold tabular-nums" aria-live="polite">{l.qty}</span>
                  <IconButton label={`Tambah ${l.name}`} variant="secondary" size="sm" onClick={() => onQty(l.productId, l.qty + 1)}>
                    <Plus size={14} aria-hidden />
                  </IconButton>
                  <IconButton label={`Hapus ${l.name}`} variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => onRemove(l.productId)}>
                    <Trash2 size={15} aria-hidden />
                  </IconButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <Input
            inputMode="numeric" placeholder="Diskon (Rp)" value={discount || ''}
            onChange={(e) => onDiscount(Number(e.target.value.replace(/\D/g, '')) || 0)}
            aria-label="Diskon dalam rupiah"
            className="h-9 text-sm"
          />
          <dl className="space-y-1 text-sm">
            <Row label="Subtotal" value={fmtID(subtotal)} />
            {discount > 0 && <Row label="Diskon" value={`− ${fmtID(discount)}`} red />}
            {t.service > 0 && <Row label={`Service ${settings?.service_percent}%`} value={fmtID(t.service)} />}
            {t.tax > 0 && <Row label={`Pajak ${settings?.tax_percent}%`} value={fmtID(t.tax)} />}
            <div className="flex items-center justify-between border-t border-dashed pt-1.5">
              <dt className="font-bold">Total</dt>
              <dd className="text-lg font-bold tabular-nums text-brand-700 dark:text-brand-300">{fmtID(t.total)}</dd>
            </div>
          </dl>
          {onHold && (
            <button
              onClick={onHold}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <PauseCircle size={17} aria-hidden /> Tahan Pesanan
            </button>
          )}
        </div>
      )}

      {/* Daftar pesanan ditahan */}
      {onResumeHold && held.length > 0 && (
        <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            <PauseCircle size={13} aria-hidden /> Ditahan ({held.length})
          </p>
          <ul className="max-h-36 space-y-1.5 overflow-y-auto" aria-label="Pesanan ditahan">
            {held.map((h) => (
              <li key={h.id} className="flex items-center gap-2 rounded-xl bg-amber-50 px-2.5 py-2 dark:bg-amber-900/20">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">
                    {h.lines.reduce((s, l) => s + l.qty, 0)} item · {fmtID(h.lines.reduce((s, l) => s + l.price * l.qty - h.discount, 0))}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {new Date(h.heldAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}{h.note ? ` · ${h.note}` : ''}
                  </p>
                </div>
                <IconButton label="Lanjutkan pesanan" size="sm" variant="secondary" onClick={() => onResumeHold(h.id)}><Play size={13} aria-hidden /></IconButton>
                <IconButton label="Buang pesanan" size="sm" variant="ghost" className="text-red-500" onClick={() => onDeleteHold?.(h.id)}><XCircle size={14} aria-hidden /></IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Indikator mode pencatatan online */}
      {online && lines.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <PlusCircle size={12} aria-hidden /> Pesanan online: hanya dicatat, pembayaran via platform
        </p>
      )}
    </div>
  )
}

function Row({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`font-semibold tabular-nums ${red ? 'text-red-600' : ''}`}>{value}</dd>
    </div>
  )
}
