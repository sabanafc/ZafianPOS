import { Receipt, Plus } from 'lucide-react'
import type { Purchase } from '../../types'
import { Button, EmptyState } from '../ui'
import { fmtID, fmtQty, fmtDateTime } from '../../lib/utils'

/** Riwayat nota pembelian bahan (terbaru dulu). */
export function PurchaseHistory({ purchases, onNew }: { purchases: Purchase[]; onNew: () => void }) {
  if (purchases.length === 0) {
    return (
      <EmptyState
        icon={<Receipt size={24} />}
        title="Belum ada pembelian"
        subtitle="Catat pembelian bahan agar stok dan HPP otomatis diperbarui."
        action={<Button onClick={onNew}><Plus size={16} aria-hidden /> Catat Pembelian</Button>}
      />
    )
  }

  return (
    <ul aria-label="Riwayat pembelian" className="space-y-3">
      {purchases.map((p) => (
        <li key={p.id} className="rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold">{p.supplier || 'Pembelian bahan'}</p>
              <p className="text-xs text-muted">{fmtDateTime(p.purchased_at)}{p.note ? ` · ${p.note}` : ''}</p>
            </div>
            <p className="text-lg font-bold tabular-nums">{fmtID(p.total)}</p>
          </div>
          {(p.items?.length ?? 0) > 0 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3">
              {p.items!.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-muted">
                    {it.ingredient?.name || 'Bahan'}
                    <span className="ml-1.5 tabular-nums">+{fmtQty(it.qty)} {it.ingredient?.unit}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">{fmtID(it.line_total)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
