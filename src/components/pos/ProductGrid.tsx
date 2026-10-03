import { useMemo } from 'react'
import { Flame, ImageOff } from 'lucide-react'
import { useProductSales } from '../../hooks/useMaster'
import { useSettings } from '../../hooks/useSettings'
import type { Category, Product } from '../../types'
import { fmtID } from '../../lib/utils'

interface Props {
  products: Product[]
  categories: Category[]
  activeCat: string
  onCat: (id: string) => void
  onPick: (p: Product) => void
}

export function ProductGrid({ products, categories, activeCat, onCat, onPick }: Props) {
  const { settings } = useSettings()
  const { data: sales = new Map() } = useProductSales(settings?.bestseller_days ?? 30)
  const cols = settings?.menu_columns ?? 0

  // Terlaris dulu (qty terjual 30 hari terakhir, terbanyak di atas), sisanya alfabetis
  const filtered = useMemo(() => {
    const inCat = products.filter((p) => activeCat === 'all' || p.category_id === activeCat)
    const max = Math.max(0, ...sales.values())
    return inCat.sort((a, b) => {
      const qa = sales.get(a.id) || 0, qb = sales.get(b.id) || 0
      if (qa !== qb) return qb - qa
      if (max > 0 && qa > 0) return -1
      if (max > 0 && qb > 0) return 1
      return a.name.localeCompare(b.name, 'id')
    })
  }, [products, activeCat, sales])

  // id produk paling laku dalam tampilan aktif (untuk badge "Terlaris")
  const topId = useMemo(() => {
    let best: string | null = null
    let bestQty = 0
    for (const p of filtered) {
      const q = sales.get(p.id) || 0
      if (q > bestQty) { bestQty = q; best = p.id }
    }
    return best
  }, [filtered, sales])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Tab kategori */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Kategori">
        <CatTab id="all" label="Semua" active={activeCat === 'all'} onClick={() => onCat('all')} count={products.length} />
        {categories.filter((c) => c.is_active).map((c) => (
          <CatTab
            key={c.id} id={c.id} label={c.name} active={activeCat === c.id}
            onClick={() => onCat(c.id)}
            count={products.filter((p) => p.category_id === c.id).length}
          />
        ))}
      </div>

      {/* Grid produk — gambar full-bleed besar */}
      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <ImageOff size={32} className="text-muted" aria-hidden />
          <p className="text-sm text-muted">Tidak ada menu ditemukan</p>
        </div>
      ) : (
        <ul
          className="grid min-h-0 flex-1 auto-rows-min content-start gap-3 overflow-y-auto pb-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          style={cols >= 3 && cols <= 5 ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}
          aria-label="Daftar menu"
        >
          {filtered.map((p) => {
            const soldOut = p.track_stock && p.stock <= 0
            return (
            <li key={p.id}>
              <button
                onClick={() => onPick(p)}
                disabled={soldOut}
                className={`group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-surface-2 text-left shadow-card ring-brand-500 transition-transform active:scale-[0.97] disabled:cursor-not-allowed ${soldOut ? 'opacity-55' : ''}`}
                aria-label={soldOut ? `${p.name} habis` : `Tambah ${p.name}, ${fmtID(p.price)}${p.track_stock ? `, sisa ${p.stock}` : ''}`}
              >
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700" aria-hidden>
                    <ImageOff size={28} className="text-muted" />
                  </div>
                )}
                {/* Badge terlaris — produk paling laku di tampilan ini, lengkap dengan qty terjual */}
                {topId === p.id && (
                  <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-orange-500/95 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow" aria-label={`Menu terlaris, terjual ${(sales.get(p.id) || 0)}x`}>
                    <Flame size={11} aria-hidden /> Terlaris · {(sales.get(p.id) || 0).toLocaleString('id-ID')}x
                  </span>
                )}
                {/* Bar info mengikuti tema — teks & harga di tengah */}
                <div className="absolute inset-x-0 bottom-0 z-10 bg-surface px-2 py-2 text-center">
                  <p className="truncate text-[15px] font-extrabold leading-tight text-ink">{p.name}</p>
                  <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-brand-700 dark:text-brand-300">{fmtID(p.price)}</p>
                </div>
                {/* Sisa stok menu (bila dilacak) */}
                {p.track_stock && (
                  <span
                    className={`absolute right-2 top-2 z-10 rounded-full px-2 py-1 text-[10px] font-extrabold shadow ${p.stock <= 0 ? 'bg-red-600 text-white' : p.stock <= p.min_stock ? 'bg-amber-500 text-white' : 'bg-white/95 text-slate-700'}`}
                  >
                    {p.stock <= 0 ? 'Habis' : `Sisa ${p.stock.toLocaleString('id-ID')}`}
                  </span>
                )}
              </button>
            </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function CatTab({ id, label, active, onClick, count }: { id: string; label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${
        active
          ? 'bg-brand-600 text-white'
          : 'border border-line bg-surface text-muted hover:bg-surface-2'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? 'bg-white/20' : 'bg-surface-2 text-muted'}`}>
        {count}
      </span>
    </button>
  )
}
