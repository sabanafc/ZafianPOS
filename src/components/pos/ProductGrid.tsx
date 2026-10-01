import { Search, ImageOff } from 'lucide-react'
import type { Category, Product } from '../../types'
import { fmtID } from '../../lib/utils'

interface Props {
  products: Product[]
  categories: Category[]
  activeCat: string
  onCat: (id: string) => void
  search: string
  onSearch: (s: string) => void
  onPick: (p: Product) => void
}

export function ProductGrid({ products, categories, activeCat, onCat, search, onSearch, onPick }: Props) {
  const filtered = products.filter((p) => {
    const okCat = activeCat === 'all' || p.category_id === activeCat
    const okSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    return okCat && okSearch
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Pencarian */}
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Cari menu…"
          aria-label="Cari menu"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

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
          className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-3 overflow-y-auto pb-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
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
                {/* Bar info mengikuti tema — teks & harga di tengah */}
                <div className="absolute inset-x-0 bottom-0 z-10 bg-white px-2 py-2 text-center dark:bg-slate-900">
                  <p className="truncate text-[15px] font-extrabold leading-tight text-slate-900 dark:text-white">{p.name}</p>
                  <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-brand-700 dark:text-brand-300">{fmtID(p.price)}</p>
                </div>
                {/* Indikator stok resep habis dihilangkan — tetap ringan */}
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
