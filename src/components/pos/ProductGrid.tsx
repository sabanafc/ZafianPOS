import { useMemo } from 'react'
import { Flame, ImageOff } from 'lucide-react'
import { useProductSales } from '../../hooks/useMaster'
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
  const { data: sales = new Map() } = useProductSales()

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
          <ImageOff size={32} className="text-slate-300" aria-hidden />
          <p className="text-sm text-slate-500">Tidak ada menu ditemukan</p>
        </div>
      ) : (
        <ul
          className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-3 overflow-y-auto pb-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          aria-label="Daftar menu"
        >
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onPick(p)}
                className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-slate-200 text-left shadow-card ring-brand-500 transition-transform active:scale-[0.97] dark:bg-slate-800"
                aria-label={`Tambah ${p.name}, ${fmtID(p.price)}`}
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
                    <ImageOff size={28} className="text-slate-400" />
                  </div>
                )}
                {/* Badge terlaris — produk paling laku di tampilan ini */}
                {topId === p.id && (
                  <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-orange-500/95 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow" aria-label="Menu terlaris">
                    <Flame size={11} aria-hidden /> Terlaris
                  </span>
                )}
                {/* Bar info mengikuti tema — teks & harga di tengah */}
                <div className="absolute inset-x-0 bottom-0 z-10 bg-white px-2 py-2 text-center dark:bg-slate-900">
                  <p className="truncate text-[15px] font-extrabold leading-tight text-slate-900 dark:text-white">{p.name}</p>
                  <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-brand-700 dark:text-brand-300">{fmtID(p.price)}</p>
                </div>
                {/* Indikator stok resep dihilangkan — tetap ringan */}
              </button>
            </li>
          ))}
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
          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
        {count}
      </span>
    </button>
  )
}
