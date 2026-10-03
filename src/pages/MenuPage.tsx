import { useMemo, useState, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2, ImageUp, UtensilsCrossed, Tags, ChefHat, Search, GripVertical, Flame, Package, Layers, RefreshCw, Minus } from 'lucide-react'
import {
  useProducts, useCategories, useSaveProduct, useDeleteProduct, useAllRecipes,
  useSaveCategory, useDeleteCategory, useReorderCategories, useSetRecipe, useIngredients, useRecipe, useToggleProduct,
  useProductSales, useAdjustProductStock,
  usePackageItems, usePackageIngredients, useSetPackageItems, useSetPackageIngredients,
  useAllPackageItems, useAllPackageIngredients,
} from '../hooks/useMaster'
import { useSettings } from '../hooks/useSettings'
import { uploadProductImage } from '../lib/storage'
import type { Category, Product } from '../types'
import { Page, Card, CardGrid, GridCard, Button, IconButton, Input, Select, Field, Badge, EmptyState, Switch, ConfirmDialog, Spinner, Segmented } from '../components/ui'
import { Modal } from '../components/Modal'
import { fmtID } from '../lib/utils'
import { toast } from '../lib/toast'

export default function MenuPage() {
  const [tab, setTab] = useState<'produk' | 'kategori'>('produk')
  return (
    <Page title="Menu & Kategori" actions={<TabSwitch tab={tab} setTab={setTab} />}>
      {tab === 'produk' ? <ProductsTab /> : <CategoriesTab />}
    </Page>
  )
}

function TabSwitch({ tab, setTab }: { tab: 'produk' | 'kategori'; setTab: (t: 'produk' | 'kategori') => void }) {
  return (
    <Segmented
      value={tab} onChange={setTab} label="Bagian menu"
      options={[
        { value: 'produk' as const, label: 'Produk', icon: <UtensilsCrossed size={15} aria-hidden /> },
        { value: 'kategori' as const, label: 'Kategori', icon: <Tags size={15} aria-hidden /> },
      ]}
    />
  )
}

// ================= PRODUK =================
function ProductsTab() {
  const { data: products = [], isLoading } = useProducts()
  const { data: categories = [] } = useCategories()
  const { data: recipes = [] } = useAllRecipes()
  const { data: pkgIngredients = [] } = useAllPackageIngredients()
  const { data: pkgItems = [] } = useAllPackageItems()
  const { settings } = useSettings()
  const { data: sales = new Map() } = useProductSales(settings?.bestseller_days ?? 30)
  const del = useDeleteProduct()
  const toggle = useToggleProduct()
  const adjustStock = useAdjustProductStock()
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [recipeForId, setRecipeForId] = useState<string | null>(null)
  const [packageForId, setPackageForId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)

  // HPP: menu biasa dari resep bahan; paket dari bahan efektif paket
  const hppMap = useMemo(() => {
    const m: Record<string, number> = {}
    const pkgIds = new Set(products.filter((p) => p.is_package).map((p) => p.id))
    for (const r of recipes as Array<{ product_id: string; qty: number; ingredient?: { cost_per_unit: number } }>) {
      if (pkgIds.has(r.product_id)) continue
      m[r.product_id] = (m[r.product_id] || 0) + r.qty * (r.ingredient?.cost_per_unit || 0)
    }
    for (const pi of pkgIngredients as Array<{ package_id: string; qty: number; ingredient?: { cost_per_unit: number } }>) {
      m[pi.package_id] = (m[pi.package_id] || 0) + pi.qty * (pi.ingredient?.cost_per_unit || 0)
    }
    return m
  }, [recipes, pkgIngredients, products])

  const componentCount = useMemo(() => {
    const m: Record<string, number> = {}
    for (const it of pkgItems) m[it.package_id] = (m[it.package_id] || 0) + 1
    return m
  }, [pkgItems])

  const editing = editingId === 'new' ? {} : products.find((p) => p.id === editingId) || null
  const recipeFor = products.find((p) => p.id === recipeForId) || null
  const packageFor = products.find((p) => p.id === packageForId) || null
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name || '—'
  const list = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))

  // 10 menu paling laku (qty terjual sesuai periode di Pengaturan)
  const topSales = useMemo(() => [...sales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10), [sales])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk…" aria-label="Cari produk" className="pl-9" />
        </div>
        <Button onClick={() => setEditingId('new')}><Plus size={17} aria-hidden /> Produk</Button>
      </div>

      {!isLoading && topSales.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold"><Flame size={15} className="text-orange-500" aria-hidden /> Menu Terlaris</h2>
          <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {topSales.map(([id, qty], i) => (
              <li key={id} className="flex items-center gap-2.5 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" aria-hidden>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{products.find((p) => p.id === id)?.name || '—'}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">{qty.toLocaleString('id-ID')}x</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : list.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed size={24} />} title="Belum ada produk" subtitle="Tambahkan produk pertama Anda" action={<Button onClick={() => setEditingId('new')}><Plus size={16} aria-hidden /> Tambah Produk</Button>} />
      ) : (
        <CardGrid>
          {list.map((p) => {
            const hpp = hppMap[p.id] || 0
            const margin = p.price > 0 ? Math.round(((p.price - hpp) / p.price) * 100) : 0
            return (
              <GridCard key={p.id} column={false} cardClassName={`flex overflow-hidden ${!p.is_active ? 'opacity-60' : ''}`}>
                  {/* gambar stretch penuh setinggi kartu — tidak menyisakan celah di bawah */}
                  <div className="flex w-24 min-h-[6rem] shrink-0 items-stretch bg-surface-2 dark:bg-surface-2">
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full object-cover" /> : <div className="flex w-full items-center justify-center text-muted"><ImageUp size={22} aria-hidden /></div>}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                          <span className="truncate">{p.name}</span>
                          {p.is_package && <Badge tone="brand">Paket</Badge>}
                        </p>
                        <p className="text-xs text-muted">
                          {catName(p.category_id)}{p.is_package && ` · ${componentCount[p.id] || 0} menu`}
                        </p>
                      </div>
                      <Switch checked={p.is_active} onChange={(v) => toggle.mutate({ id: p.id, is_active: v })} label={`${p.is_active ? 'Sembunyikan' : 'Tampilkan'} ${p.name} di kasir`} />
                    </div>
                    <p className="mt-1 text-sm font-bold tabular-nums text-brand-700 dark:text-brand-300">{fmtID(p.price)}</p>
                    <p className="text-xs tabular-nums text-muted">
                      HPP {fmtID(hpp)} · <span className={margin >= 50 ? 'font-semibold text-green-700 dark:text-green-400' : margin >= 25 ? 'font-semibold text-amber-600' : 'font-semibold text-red-600'}>margin {margin}%</span>
                    </p>
                    {p.track_stock && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        <span className={`font-semibold tabular-nums ${p.stock <= 0 ? 'text-red-600 dark:text-red-400' : p.stock <= p.min_stock ? 'text-amber-600' : 'text-muted'}`}>
                          Stok {p.stock.toLocaleString('id-ID')}
                        </span>
                        <button type="button" onClick={() => adjustStock.mutate({ id: p.id, delta: 1 })} aria-label={`Tambah stok ${p.name}`}
                          className="flex h-5 w-5 items-center justify-center rounded-md border border-line text-muted hover:bg-surface-2 dark:border-line dark:hover:bg-surface-2">
                          <Plus size={12} aria-hidden />
                        </button>
                        <button type="button" onClick={() => adjustStock.mutate({ id: p.id, delta: -1 })} aria-label={`Kurangi stok ${p.name}`}
                          className="flex h-5 w-5 items-center justify-center rounded-md border border-line text-muted hover:bg-surface-2 dark:border-line dark:hover:bg-surface-2">
                          <Minus size={12} aria-hidden />
                        </button>
                      </div>
                    )}
                    <div className="mt-auto flex gap-1 pt-2">
                      <IconButton label={`Edit ${p.name}`} size="sm" variant="secondary" onClick={() => setEditingId(p.id)}><Pencil size={14} aria-hidden /></IconButton>
                      {p.is_package ? (
                        <IconButton label={`Atur paket ${p.name}`} size="sm" variant="secondary" onClick={() => setPackageForId(p.id)}><Layers size={14} aria-hidden /></IconButton>
                      ) : (
                        <IconButton label={`Resep ${p.name}`} size="sm" variant="secondary" onClick={() => setRecipeForId(p.id)}><ChefHat size={14} aria-hidden /></IconButton>
                      )}
                      <IconButton label={`Hapus ${p.name}`} size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleting(p)}><Trash2 size={14} aria-hidden /></IconButton>
                    </div>
                  </div>
              </GridCard>
            )
          })}
        </CardGrid>
      )}

      {editingId !== null && (
        <ProductFormModal key={editingId} product={editing!} onClose={() => setEditingId(null)} categories={categories} />
      )}
      {recipeFor && <RecipeModal key={recipeFor.id} product={recipeFor} onClose={() => setRecipeForId(null)} />}
      {packageFor && <PackageModal key={packageFor.id} product={packageFor} onClose={() => setPackageForId(null)} />}
      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)}
        title="Hapus produk?" message={`"${deleting?.name}" akan dihapus beserta resepnya. Transaksi lama tetap tersimpan.`}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => toast.success('Produk dihapus'), onError: (e: Error) => toast.error(e.message) })}
      />
    </div>
  )
}

// ================= FORM PRODUK =================
function ProductFormModal({ product, onClose, categories }: { product: Partial<Product>; onClose: () => void; categories: Category[] }) {
  const save = useSaveProduct()
  const [name, setName] = useState(product?.name || '')
  const [price, setPrice] = useState(product?.price ? String(product.price) : '')
  const [catId, setCatId] = useState(product?.category_id || '')
  const [active, setActive] = useState(product?.is_active ?? true)
  const [track, setTrack] = useState(product?.track_stock ?? false)
  const [stock, setStock] = useState(product?.stock ? String(product.stock) : '')
  const [minStock, setMinStock] = useState(product?.min_stock ? String(product.min_stock) : '')
  const [isPkg, setIsPkg] = useState(product?.is_package ?? false)
  const [dailyTarget, setDailyTarget] = useState(product?.daily_target ? String(product.daily_target) : '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(product?.image_url || null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isNew = !product.id
  const busy = save.isPending

  const pickFile = (f: File | null) => {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : product.image_url || null)
  }

  const submit = async () => {
    if (!name.trim()) { toast.error('Nama produk wajib diisi'); return }
    try {
      let image_url = product.image_url || null
      if (file) {
        const tmpId = product.id || crypto.randomUUID()
        image_url = await uploadProductImage(file, tmpId)
      }
      save.mutate(
        {
          id: product.id, name: name.trim(), price: Number(price) || 0, category_id: catId || null, image_url, is_active: active,
          stock: Number(stock.replace(',', '.')) || 0,
          min_stock: Number(minStock.replace(',', '.')) || 0,
          track_stock: track, is_package: isPkg,
          daily_target: Number(dailyTarget.replace(',', '.')) || 0,
        },
        { onSuccess: () => { toast.success(isNew ? 'Produk ditambahkan' : 'Produk disimpan'); onClose() }, onError: (e: Error) => toast.error(e.message) },
      )
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Tambah Produk' : 'Edit Produk'}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-[2]" onClick={submit} disabled={busy}>{busy ? <Spinner className="text-white" /> : null} Simpan</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink">Foto menu</span>
          <button
            onClick={() => fileRef.current?.click()}
            className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-surface-2 hover:border-brand-400 dark:border-line dark:bg-surface-2"
            aria-label="Pilih foto produk"
          >
            {preview ? <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" /> : (
              <span className="flex flex-col items-center gap-2 text-muted">
                <ImageUp size={26} aria-hidden />
                <span className="text-sm font-medium">Ketuk untuk pilih foto</span>
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
          {preview && (
            <button type="button" className="mt-1.5 text-xs font-semibold text-red-600" onClick={() => { setFile(null); setPreview(null) }}>
              Hapus foto
            </button>
          )}
        </div>
        <Field label="Nama produk" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Es Kopi Susu" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Harga jual (Rp)" required>
            <Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="0" />
          </Field>
          <Field label="Kategori">
            <Select value={catId} onChange={(e) => setCatId(e.target.value)}>
              <option value="">— Tanpa kategori —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Target penjualan harian (porsi)" hint="Untuk menghitung kebutuhan bahan & rekomendasi pembelian walau data penjualan belum ada.">
          <Input inputMode="decimal" value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="mis. 30" />
        </Field>
        <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3 dark:bg-surface-2">
          <span className="text-sm font-medium">Tampilkan di kasir</span>
          <Switch checked={active} onChange={setActive} label="Tampilkan di kasir" />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3 dark:bg-surface-2">
          <span className="text-sm font-medium">Lacak stok menu</span>
          <Switch checked={track} onChange={setTrack} label="Lacak stok menu" />
        </div>
        {track && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stok saat ini">
              <Input inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0" />
            </Field>
            <Field label="Stok minimum">
              <Input inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0" />
            </Field>
          </div>
        )}
        <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3 dark:bg-surface-2">
          <span className="text-sm font-medium">Menu ini paket</span>
          <Switch checked={isPkg} onChange={setIsPkg} label="Menu ini paket gabungan" />
        </div>
        {isPkg && (
          <p className="rounded-xl bg-brand-50 p-3 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
            Simpan dulu, lalu atur isi paket dari tombol <strong>Paket</strong> di kartu menu. HPP paket dihitung dari bahan gabungan menu komponen.
          </p>
        )}
      </div>
    </Modal>
  )
}

// ================= RESEP / BOM =================
function RecipeModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data: ingredients = [] } = useIngredients()
  const { data: existing = [], isLoading } = useRecipe(product.id)
  const setRecipe = useSetRecipe()
  const [rows, setRows] = useState<Array<{ ingredient_id: string; qty: string }> | null>(null)

  if (isLoading) return <Modal open onClose={onClose} title="Resep"><Spinner /></Modal>

  const current = rows ?? existing.map((r) => ({ ingredient_id: r.ingredient_id, qty: String(r.qty) }))

  const setRow = (i: number, patch: Partial<{ ingredient_id: string; qty: string }>) =>
    setRows(current.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows([...current, { ingredient_id: '', qty: '' }])
  const removeRow = (i: number) => setRows(current.filter((_, j) => j !== i))

  const hpp = current.reduce((s, r) => {
    const ing = ingredients.find((x) => x.id === r.ingredient_id)
    return s + (Number(r.qty.replace(',', '.')) || 0) * (ing?.cost_per_unit || 0)
  }, 0)
  const margin = product.price > 0 ? Math.round(((product.price - hpp) / product.price) * 100) : 0

  const submit = () => {
    const items = current
      .filter((r) => r.ingredient_id && Number(r.qty.replace(',', '.')) > 0)
      .map((r) => ({ ingredient_id: r.ingredient_id, qty: Number(r.qty.replace(',', '.')) }))
    setRecipe.mutate(
      { productId: product.id, items },
      { onSuccess: () => { toast.success('Resep disimpan — HPP diperbarui'); onClose() }, onError: (e: Error) => toast.error(e.message) },
    )
  }

  return (
    <Modal open onClose={onClose} title={`Resep · ${product.name}`} size="lg"
      footer={
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">HPP per porsi</span>
            <span className="font-bold tabular-nums">
              {fmtID(hpp)}{' '}
              <span className={margin >= 50 ? 'text-green-600' : margin >= 25 ? 'text-amber-600' : 'text-red-600'}>· margin {margin}%</span>
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
            <Button className="flex-[2]" onClick={submit} disabled={setRecipe.isPending}>Simpan Resep</Button>
          </div>
        </div>
      }
    >
      {/* Header kolom — sejajar dengan grid baris */}
      <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_6rem_3.5rem_2.25rem] items-center gap-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">
        <span>Bahan</span>
        <span className="text-right">Jumlah</span>
        <span className="text-center">Satuan</span>
        <span aria-hidden />
      </div>
      <div className="space-y-2">
        {current.length === 0 && <p className="py-4 text-center text-sm text-muted">Belum ada bahan. Tambahkan bahan pembentuk HPP.</p>}
        {current.map((r, i) => {
          const ing = ingredients.find((x) => x.id === r.ingredient_id)
          return (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_6rem_3.5rem_2.25rem] items-center gap-2">
              <Select value={r.ingredient_id} onChange={(e) => setRow(i, { ingredient_id: e.target.value })} aria-label={`Bahan ${i + 1}`} className="w-full min-w-0">
                <option value="">— pilih bahan —</option>
                {ingredients.filter((x) => x.is_active || x.id === r.ingredient_id).map((x) => (
                  <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>
                ))}
              </Select>
              <Input
                inputMode="decimal" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value.replace(/[^0-9.,]/g, '') })}
                placeholder="0" aria-label={`Jumlah ${ing?.name || ''}`} className="w-full text-right" />
              <span className="truncate text-center text-xs text-muted">{ing?.unit || '—'}</span>
              <IconButton label="Hapus baris" size="sm" variant="ghost" className="mx-auto text-red-500" onClick={() => removeRow(i)}><Trash2 size={14} aria-hidden /></IconButton>
            </div>
          )
        })}
        <Button variant="secondary" className="w-full" onClick={addRow}><Plus size={16} aria-hidden /> Tambah Bahan</Button>
      </div>
    </Modal>
  )
}

// ================= PAKET (gabungan menu) =================
const round3 = (n: number) => Math.round(n * 1000) / 1000

function PackageModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data: products = [] } = useProducts()
  const { data: ingredients = [] } = useIngredients()
  const { data: recipes = [] } = useAllRecipes()
  const { data: allPkgIngredients = [] } = useAllPackageIngredients()
  const { data: existingItems = [], isLoading: loadingItems } = usePackageItems(product.id)
  const { data: existingIng = [], isLoading: loadingIng } = usePackageIngredients(product.id)
  const setItems = useSetPackageItems()
  const setIng = useSetPackageIngredients()

  const [rows, setRows] = useState<Array<{ component_id: string; qty: string }> | null>(null)
  const [ingRows, setIngRows] = useState<Array<{ ingredient_id: string; qty: string }> | null>(null)
  const [split, setSplit] = useState(false)

  const comps = rows ?? existingItems.map((r) => ({ component_id: r.component_id, qty: String(r.qty) }))
  const candidates = products.filter((p) => p.id !== product.id)

  /** Susun bahan dari menu komponen: paket → bahan efektifnya; menu biasa → resepnya.
   *  split=true → satu baris per menu (bahan sama tampil terpisah). */
  const derive = (list: Array<{ component_id: string; qty: string }>): Array<{ ingredient_id: string; qty: string }> => {
    const merged = new Map<string, number>()
    const out: Array<{ ingredient_id: string; qty: string }> = []
    for (const c of list) {
      const prod = products.find((p) => p.id === c.component_id)
      const q = Number(c.qty.replace(',', '.')) || 0
      if (!prod || q <= 0) continue
      const src = prod.is_package
        ? allPkgIngredients.filter((pi) => pi.package_id === prod.id).map((pi) => ({ ingredient_id: pi.ingredient_id, qty: pi.qty }))
        : recipes.filter((r) => r.product_id === prod.id).map((r) => ({ ingredient_id: r.ingredient_id, qty: r.qty }))
      for (const s of src) {
        if (split) out.push({ ingredient_id: s.ingredient_id, qty: String(round3(s.qty * q)) })
        else merged.set(s.ingredient_id, (merged.get(s.ingredient_id) || 0) + s.qty * q)
      }
    }
    return split ? out : [...merged.entries()].map(([ingredient_id, qty]) => ({ ingredient_id, qty: String(round3(qty)) }))
  }

  const showIng: Array<{ ingredient_id: string; qty: string }> = ingRows
    ?? (existingIng.length ? existingIng.map((r) => ({ ingredient_id: r.ingredient_id, qty: String(r.qty) })) : derive(comps))

  const setComp = (i: number, patch: Partial<{ component_id: string; qty: string }>) =>
    setRows(comps.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const addComp = () => setRows([...comps, { component_id: '', qty: '1' }])
  const removeComp = (i: number) => setRows(comps.filter((_, j) => j !== i))

  const setIngRow = (i: number, patch: Partial<{ ingredient_id: string; qty: string }>) =>
    setIngRows(showIng.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const addIngRow = () => setIngRows([...showIng, { ingredient_id: '', qty: '' }])
  const removeIngRow = (i: number) => setIngRows(showIng.filter((_, j) => j !== i))
  const recalc = () => { setIngRows(derive(comps)); toast.info('Bahan paket dihitung ulang dari menu komponen') }

  const num = (s: string) => Number(s.replace(',', '.')) || 0
  const hpp = showIng.reduce((s, r) => s + num(r.qty) * (ingredients.find((x) => x.id === r.ingredient_id)?.cost_per_unit || 0), 0)
  const margin = product.price > 0 ? Math.round(((product.price - hpp) / product.price) * 100) : 0
  const busy = setItems.isPending || setIng.isPending

  if (loadingItems || loadingIng) return <Modal open onClose={onClose} title="Paket"><Spinner /></Modal>

  const submit = async () => {
    const items = comps.filter((c) => c.component_id && num(c.qty) > 0).map((c) => ({ component_id: c.component_id, qty: num(c.qty) }))
    const ings = showIng.filter((r) => r.ingredient_id && num(r.qty) > 0).map((r) => ({ ingredient_id: r.ingredient_id, qty: num(r.qty) }))
    try {
      await setItems.mutateAsync({ packageId: product.id, items })
      await setIng.mutateAsync({ packageId: product.id, items: ings })
      toast.success('Paket disimpan — HPP diperbarui')
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Paket · ${product.name}`} size="lg"
      footer={
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">HPP paket per porsi</span>
            <span className="font-bold tabular-nums">
              {fmtID(hpp)}{' '}
              <span className={margin >= 50 ? 'text-green-600' : margin >= 25 ? 'text-amber-600' : 'text-red-600'}>· margin {margin}%</span>
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
            <Button className="flex-[2]" onClick={submit} disabled={busy}>{busy ? <Spinner className="text-white" /> : null} Simpan Paket</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Isi paket: menu komponen */}
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-bold"><Package size={15} aria-hidden /> Menu komponen</h3>
          <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_5rem_2.25rem] items-center gap-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            <span>Menu</span><span className="text-right">Jumlah</span><span aria-hidden />
          </div>
          <div className="space-y-2">
            {comps.length === 0 && <p className="py-3 text-center text-sm text-muted">Belum ada menu. Tambahkan menu penyusun paket.</p>}
            {comps.map((c, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_5rem_2.25rem] items-center gap-2">
                <Select value={c.component_id} onChange={(e) => setComp(i, { component_id: e.target.value })} aria-label={`Menu ${i + 1}`} className="w-full min-w-0">
                  <option value="">— pilih menu —</option>
                  {candidates.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_package ? ' (paket)' : ''}</option>)}
                </Select>
                <Input inputMode="decimal" value={c.qty} onChange={(e) => setComp(i, { qty: e.target.value.replace(/[^0-9.,]/g, '') })} placeholder="1" aria-label={`Jumlah menu ${i + 1}`} className="w-full text-right" />
                <IconButton label="Hapus menu" size="sm" variant="ghost" className="mx-auto text-red-500" onClick={() => removeComp(i)}><Trash2 size={14} aria-hidden /></IconButton>
              </div>
            ))}
            <Button variant="secondary" className="w-full" onClick={addComp}><Plus size={16} aria-hidden /> Tambah Menu</Button>
          </div>
        </section>

        {/* Bahan efektif paket (bisa disesuaikan manual) */}
        <section>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold"><ChefHat size={15} aria-hidden /> Bahan paket (HPP)</h3>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} className="h-4 w-4 rounded border-line" />
              Pisah per menu
            </label>
          </div>
          <Button variant="secondary" className="mb-2 w-full" onClick={recalc}><RefreshCw size={15} aria-hidden /> Hitung ulang dari menu</Button>
          <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_5rem_3rem_2.25rem] items-center gap-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            <span>Bahan</span><span className="text-right">Jumlah</span><span className="text-center">Satuan</span><span aria-hidden />
          </div>
          <div className="space-y-2">
            {showIng.length === 0 && <p className="py-3 text-center text-sm text-muted">Belum ada bahan. Hitung ulang dari menu atau tambah manual.</p>}
            {showIng.map((r, i) => {
              const ing = ingredients.find((x) => x.id === r.ingredient_id)
              return (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_5rem_3rem_2.25rem] items-center gap-2">
                  <Select value={r.ingredient_id} onChange={(e) => setIngRow(i, { ingredient_id: e.target.value })} aria-label={`Bahan ${i + 1}`} className="w-full min-w-0">
                    <option value="">— pilih bahan —</option>
                    {ingredients.filter((x) => x.is_active || x.id === r.ingredient_id).map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
                  </Select>
                  <Input inputMode="decimal" value={r.qty} onChange={(e) => setIngRow(i, { qty: e.target.value.replace(/[^0-9.,]/g, '') })} placeholder="0" aria-label={`Jumlah ${ing?.name || ''}`} className="w-full text-right" />
                  <span className="truncate text-center text-xs text-muted">{ing?.unit || '—'}</span>
                  <IconButton label="Hapus baris" size="sm" variant="ghost" className="mx-auto text-red-500" onClick={() => removeIngRow(i)}><Trash2 size={14} aria-hidden /></IconButton>
                </div>
              )
            })}
            <Button variant="secondary" className="w-full" onClick={addIngRow}><Plus size={16} aria-hidden /> Tambah Bahan</Button>
          </div>
        </section>
      </div>
    </Modal>
  )
}

// ================= KATEGORI =================
function CategoriesTab() {
  const { data: categories = [] } = useCategories()
  const { data: products = [] } = useProducts()
  const save = useSaveCategory()
  const del = useDeleteCategory()
  const reorder = useReorderCategories()
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  // urutan sementara saat drag (optimistis), null = pakai urutan dari server
  const [order, setOrder] = useState<Category[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const dragRef = useRef<{ raf: number } | null>(null)
  const list = order ?? categories

  // setelah disimpan & data server segar masuk, buang urutan optimistis
  useEffect(() => { setOrder(null) }, [categories])

  const commitOrder = (next: Category[]) => {
    setDragId(null)
    setOrder(next)
    if (next.length === categories.length && next.every((c, i) => categories[i]?.id === c.id)) { setOrder(null); return } // tidak berubah
    reorder.mutate(next.map((c) => c.id), {
      onSuccess: () => toast.success('Urutan kategori disimpan'),
      onError: (e: Error) => { setOrder(null); toast.error(e.message) },
    })
  }

  /** Drag & drop via pointer events — jalan untuk sentuh (tablet) maupun mouse.
   *  Selama digeser, daftar diatur ulang secara langsung; sort_order disimpan saat dilepas. */
  const onHandlePointerDown = (e: React.PointerEvent, id: string) => {
    if (dragRef.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault() // cegah seleksi teks
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const rows = () => Array.from(el.closest('ul')?.querySelectorAll<HTMLElement>('[data-cat-id]') ?? [])
    let lastOrder = list
    let raf = 0

    const cleanup = () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      dragRef.current = null
    }
    const onMove = (ev: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const els = rows()
        const from = els.findIndex((r) => r.dataset.catId === id)
        if (from < 0) return
        // cari baris yang berada di bawah jari/kursor
        let to = from
        for (let j = 0; j < els.length; j++) {
          const rect = els[j].getBoundingClientRect()
          if (ev.clientY >= rect.top && ev.clientY <= rect.bottom) { to = j; break }
        }
        if (to === from) return
        const next = [...lastOrder]
        const [it] = next.splice(from, 1)
        next.splice(to, 0, it)
        lastOrder = next
        setOrder(next)
      })
    }
    const onUp = () => {
      cleanup()
      commitOrder(lastOrder)
    }
    const onCancel = () => {
      cleanup()
      setOrder(null)
      setDragId(null)
    }

    dragRef.current = { raf: 0 }
    setDragId(id)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
  }


  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({})}><Plus size={17} aria-hidden /> Kategori</Button>
      </div>
      {categories.length === 0 ? (
        <EmptyState icon={<Tags size={24} />} title="Belum ada kategori" />
      ) : (
        <ul className="space-y-2" aria-label="Daftar kategori">
          {list.map((c, i) => (
            <li key={c.id} data-cat-id={c.id} className="select-none">
              <Card className={`flex items-center gap-3 p-3 transition-shadow ${dragId === c.id ? 'ring-2 ring-brand-500 shadow-lg' : ''}`}>
                <button
                  type="button"
                  aria-label={`Geser posisi ${c.name}`}
                  onPointerDown={(e) => onHandlePointerDown(e, c.id)}
                  className={`flex h-10 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-muted hover:bg-surface-2 active:cursor-grabbing dark:hover:bg-surface-2 ${dragId === c.id ? 'text-brand-600' : ''}`}
                >
                  <GripVertical size={18} aria-hidden />
                </button>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" aria-hidden>
                  <Tags size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">{products.filter((p) => p.category_id === c.id).length} produk · urutan {i + 1}</p>
                </div>
                {!c.is_active && <Badge tone="slate">Nonaktif</Badge>}
                <IconButton label={`Edit ${c.name}`} size="sm" variant="secondary" onClick={() => setEditing(c)}><Pencil size={14} aria-hidden /></IconButton>
                <IconButton label={`Hapus ${c.name}`} size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleting(c)}><Trash2 size={14} aria-hidden /></IconButton>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CategoryModal cat={editing} onClose={() => setEditing(null)} onSave={(c) => save.mutate(c, { onSuccess: () => { toast.success('Kategori disimpan'); setEditing(null) }, onError: (e: Error) => toast.error(e.message) })} />
      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)}
        title="Hapus kategori?" message={`Kategori "${deleting?.name}" akan dihapus. Produk di dalamnya tidak ikut terhapus.`}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => toast.success('Kategori dihapus'), onError: (e: Error) => toast.error(e.message) })}
      />
    </div>
  )
}

function CategoryModal({ cat, onClose, onSave }: { cat: Partial<Category> | null; onClose: () => void; onSave: (c: Partial<Category> & { name: string }) => void }) {
  const [name, setName] = useState(cat?.name || '')
  const [order, setOrder] = useState(String(cat?.sort_order ?? 0))
  const [active, setActive] = useState(cat?.is_active ?? true)
  if (!cat) return null
  return (
    <Modal open onClose={onClose} title={cat.id ? 'Edit Kategori' : 'Tambah Kategori'} size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-[2]" onClick={() => onSave({ id: cat.id, name: name.trim(), sort_order: Number(order) || 0, is_active: active })}>Simpan</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Nama kategori" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Kopi" /></Field>
        <Field label="Urutan tampil"><Input inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ''))} /></Field>
        <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3 dark:bg-surface-2">
          <span className="text-sm font-medium">Aktif</span>
          <Switch checked={active} onChange={setActive} label="Kategori aktif" />
        </div>
      </div>
    </Modal>
  )
}
