import { useMemo, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, ImageUp, UtensilsCrossed, Tags, ChefHat, Search, ChevronUp, ChevronDown, Power } from 'lucide-react'
import {
  useProducts, useCategories, useSaveProduct, useDeleteProduct, useAllRecipes,
  useSaveCategory, useDeleteCategory, useMoveCategory, useSetRecipe, useIngredients, useRecipe, useToggleProduct,
} from '../hooks/useMaster'
import { uploadProductImage } from '../lib/storage'
import type { Category, Product } from '../types'
import { Page, Card, Button, IconButton, Input, Select, Field, Badge, EmptyState, Switch, ConfirmDialog, Spinner } from '../components/ui'
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
    <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Bagian menu">
      {(['produk', 'kategori'] as const).map((t) => (
        <button
          key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
          className={`flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold ${tab === t ? 'bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white' : 'text-slate-500'}`}
        >
          {t === 'produk' ? <UtensilsCrossed size={15} aria-hidden /> : <Tags size={15} aria-hidden />}
          {t === 'produk' ? 'Produk' : 'Kategori'}
        </button>
      ))}
    </div>
  )
}

// ================= PRODUK =================
function ProductsTab() {
  const { data: products = [], isLoading } = useProducts()
  const { data: categories = [] } = useCategories()
  const { data: recipes = [] } = useAllRecipes()
  const del = useDeleteProduct()
  const toggle = useToggleProduct()
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [recipeForId, setRecipeForId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)

  const hppMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of recipes as Array<{ product_id: string; qty: number; ingredient?: { cost_per_unit: number } }>) {
      m[r.product_id] = (m[r.product_id] || 0) + r.qty * (r.ingredient?.cost_per_unit || 0)
    }
    return m
  }, [recipes])

  const editing = editingId === 'new' ? {} : products.find((p) => p.id === editingId) || null
  const recipeFor = products.find((p) => p.id === recipeForId) || null
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name || '—'
  const list = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk…" aria-label="Cari produk" className="pl-9" />
        </div>
        <Button onClick={() => setEditingId('new')}><Plus size={17} aria-hidden /> Produk</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : list.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed size={24} />} title="Belum ada produk" subtitle="Tambahkan produk pertama Anda" action={<Button onClick={() => setEditingId('new')}><Plus size={16} aria-hidden /> Tambah Produk</Button>} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const hpp = hppMap[p.id] || 0
            const margin = p.price > 0 ? Math.round(((p.price - hpp) / p.price) * 100) : 0
            return (
              <li key={p.id}>
                <Card className={`flex overflow-hidden ${!p.is_active ? 'opacity-60' : ''}`}>
                  <div className="h-24 w-24 shrink-0 bg-slate-100 dark:bg-slate-800">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><ImageUp size={22} aria-hidden /></div>}
                  </div>
                  <div className="min-w-0 flex-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{p.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{catName(p.category_id)}</p>
                      </div>
                      <Switch checked={p.is_active} onChange={(v) => toggle.mutate({ id: p.id, is_active: v })} label={`${p.is_active ? 'Sembunyikan' : 'Tampilkan'} ${p.name} di kasir`} />
                    </div>
                    <p className="mt-1 text-sm font-bold tabular-nums text-brand-700 dark:text-brand-300">{fmtID(p.price)}</p>
                    <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      HPP {fmtID(hpp)} · <span className={margin >= 50 ? 'font-semibold text-green-700 dark:text-green-400' : margin >= 25 ? 'font-semibold text-amber-600' : 'font-semibold text-red-600'}>margin {margin}%</span>
                    </p>
                    <div className="mt-2 flex gap-1">
                      <IconButton label={`Edit ${p.name}`} size="sm" variant="secondary" onClick={() => setEditingId(p.id)}><Pencil size={14} aria-hidden /></IconButton>
                      <IconButton label={`Resep ${p.name}`} size="sm" variant="secondary" onClick={() => setRecipeForId(p.id)}><ChefHat size={14} aria-hidden /></IconButton>
                      <IconButton label={`Hapus ${p.name}`} size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleting(p)}><Trash2 size={14} aria-hidden /></IconButton>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {editingId !== null && (
        <ProductFormModal key={editingId} product={editing!} onClose={() => setEditingId(null)} categories={categories} />
      )}
      {recipeFor && <RecipeModal key={recipeFor.id} product={recipeFor} onClose={() => setRecipeForId(null)} />}
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
        { id: product.id, name: name.trim(), price: Number(price) || 0, category_id: catId || null, image_url, is_active: active },
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
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Foto menu</span>
          <button
            onClick={() => fileRef.current?.click()}
            className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800"
            aria-label="Pilih foto produk"
          >
            {preview ? <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" /> : (
              <span className="flex flex-col items-center gap-2 text-slate-400">
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
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <span className="text-sm font-medium">Tampilkan di kasir</span>
          <Switch checked={active} onChange={setActive} label="Tampilkan di kasir" />
        </div>
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
            <span className="text-slate-500 dark:text-slate-400">HPP per porsi</span>
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
      <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_6rem_3.5rem_2.25rem] items-center gap-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        <span>Bahan</span>
        <span className="text-right">Jumlah</span>
        <span className="text-center">Satuan</span>
        <span aria-hidden />
      </div>
      <div className="space-y-2">
        {current.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Belum ada bahan. Tambahkan bahan pembentuk HPP.</p>}
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
              <span className="truncate text-center text-xs text-slate-500">{ing?.unit || '—'}</span>
              <IconButton label="Hapus baris" size="sm" variant="ghost" className="mx-auto text-red-500" onClick={() => removeRow(i)}><Trash2 size={14} aria-hidden /></IconButton>
            </div>
          )
        })}
        <Button variant="secondary" className="w-full" onClick={addRow}><Plus size={16} aria-hidden /> Tambah Bahan</Button>
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
  const move = useMoveCategory()
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({})}><Plus size={17} aria-hidden /> Kategori</Button>
      </div>
      {categories.length === 0 ? (
        <EmptyState icon={<Tags size={24} />} title="Belum ada kategori" />
      ) : (
        <ul className="space-y-2" aria-label="Daftar kategori">
          {categories.map((c, i) => (
            <li key={c.id}>
              <Card className="flex items-center gap-3 p-3">
                <div className="flex flex-col">
                  <IconButton label={`Naikkan ${c.name}`} size="sm" variant="ghost" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ id: c.id, dir: 'up' })}><ChevronUp size={15} aria-hidden /></IconButton>
                  <IconButton label={`Turunkan ${c.name}`} size="sm" variant="ghost" disabled={i === categories.length - 1 || move.isPending} onClick={() => move.mutate({ id: c.id, dir: 'down' })}><ChevronDown size={15} aria-hidden /></IconButton>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" aria-hidden>
                  <Tags size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{products.filter((p) => p.category_id === c.id).length} produk · urutan {i + 1}</p>
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
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <span className="text-sm font-medium">Aktif</span>
          <Switch checked={active} onChange={setActive} label="Kategori aktif" />
        </div>
      </div>
    </Modal>
  )
}
