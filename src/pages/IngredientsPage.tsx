import { useState } from 'react'
import { Plus, Pencil, Trash2, Package, ArrowDownToLine, ArrowUpFromLine, Scale, History, AlertTriangle, Calculator, Bell, BellOff, ArrowRightLeft } from 'lucide-react'
import { useIngredients, useSaveIngredient, useDeleteIngredient, useAdjustStock, useToggleIngredient, useToggleStockAlert, useProducts, useAllRecipes, useAllPackageIngredients } from '../hooks/useMaster'
import { useStockMovements } from '../hooks/useOrders'
import { usePurchases, useIngredientUsage } from '../hooks/usePurchases'
import type { Ingredient } from '../types'
import { Page, CardGrid, GridCard, Button, IconButton, Input, Select, Field, Badge, EmptyState, Switch, ConfirmDialog, Spinner, Segmented } from '../components/ui'
import { Modal } from '../components/Modal'
import { RecommendationView } from '../components/purchasing/RecommendationView'
import { PurchaseHistory } from '../components/purchasing/PurchaseHistory'
import { PurchaseModal, type PurchasePrefill } from '../components/purchasing/PurchaseModal'
import { fmtID, fmtQty, fmtDateTime, num } from '../lib/utils'
import { ALL_UNITS, VOLUME_UNITS, WEIGHT_UNITS, costPerRecipeUnit, sameFamily, convertPurchaseToRecipe } from '../lib/units'
import { toast } from '../lib/toast'

type Tab = 'bahan' | 'rekomendasi' | 'pembelian'

export default function IngredientsPage() {
  const { data: ingredients = [], isLoading } = useIngredients()
  const { data: moves = [] } = useStockMovements()
  const del = useDeleteIngredient()
  const toggle = useToggleIngredient()
  const toggleAlert = useToggleStockAlert()
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [adjusting, setAdjusting] = useState<{ ing: Ingredient; mode: 'in' | 'out' } | null>(null)
  const [opnameFor, setOpnameFor] = useState<Ingredient | null>(null)
  const [deleting, setDeleting] = useState<Ingredient | null>(null)
  const [histOpen, setHistOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('bahan')
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [purchasePrefill, setPurchasePrefill] = useState<PurchasePrefill[]>([])
  const { data: purchases = [] } = usePurchases()
  const { data: usage = {} } = useIngredientUsage()
  const { data: products = [] } = useProducts()
  const { data: recipes = [] } = useAllRecipes()
  const { data: packageIngredients = [] } = useAllPackageIngredients()

  const editing = editingId === 'new' ? {} : ingredients.find((i) => i.id === editingId) || null
  const lowCount = ingredients.filter((i) => i.stock <= i.min_stock).length

  return (
    <Page
      title="Bahan Baku"
      actions={
        <div className="flex gap-2">
          {tab === 'bahan' && (
            <>
              <IconButton label="Riwayat stok" variant="secondary" onClick={() => setHistOpen(true)}><History size={18} aria-hidden /></IconButton>
              <Button onClick={() => setEditingId('new')}><Plus size={17} aria-hidden /> Bahan</Button>
            </>
          )}
          {tab === 'pembelian' && (
            <Button onClick={() => { setPurchasePrefill([]); setPurchaseOpen(true) }}><Plus size={17} aria-hidden /> Pembelian</Button>
          )}
        </div>
      }
    >
      <Segmented<Tab>
        label="Bagian bahan baku" kind="tabs" full className="mb-4"
        value={tab} onChange={setTab}
        options={[
          { value: 'bahan', label: 'Stok Bahan' },
          { value: 'rekomendasi', label: 'Rekomendasi' },
          { value: 'pembelian', label: 'Pembelian' },
        ]}
      />

      {tab === 'bahan' && (<>
      {lowCount > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" role="alert">
          <AlertTriangle size={18} aria-hidden />
          {lowCount} bahan mencapai stok minimum — segera lakukan pembelian.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : ingredients.length === 0 ? (
        <EmptyState icon={<Package size={24} />} title="Belum ada bahan baku" subtitle="Tambahkan bahan dasar untuk menghitung HPP dan stok otomatis" action={<Button onClick={() => setEditingId('new')}><Plus size={16} aria-hidden /> Tambah Bahan</Button>} />
      ) : (
        <CardGrid label="Daftar bahan baku">
          {ingredients.map((i) => {
            const low = i.stock <= i.min_stock
            const converted = i.purchase_unit && i.purchase_unit !== i.unit
              ? convertPurchaseToRecipe(i.purchase_qty || 1, i.purchase_unit, i.unit)
              : null
            return (
              <GridCard key={i.id} cardClassName={`p-4 ${!i.is_active ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{i.name}</p>
                      <p className="break-words text-xs text-muted">
                        {i.purchase_price ? `${fmtID(i.purchase_price)} / ${fmtQty(i.purchase_qty || 1)} ${i.purchase_unit}` : `${fmtID(i.cost_per_unit)} / ${i.unit}`}
                      </p>
                      {converted !== null && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                          <ArrowRightLeft size={11} aria-hidden />
                          {fmtQty(i.purchase_qty || 1)} {i.purchase_unit} = {fmtQty(converted)} {i.unit}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {low && <Badge tone="red">Kritis</Badge>}
                      <Switch checked={i.is_active} onChange={(v) => toggle.mutate({ id: i.id, is_active: v })} label={`${i.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${i.name}`} />
                    </div>
                  </div>
                  {/* mt-auto + pt-3: baris stok selalu menempel bawah agar rapi meski kartu tanpa baris konversi */}
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
                    <div>
                      <p className={`text-2xl font-bold tabular-nums ${low ? 'text-red-600' : ''}`}>{fmtQty(i.stock)} <span className="text-sm font-medium text-muted">{i.unit}</span></p>
                      <p className="text-xs text-muted">min. {fmtQty(i.min_stock)} {i.unit} · HPP {fmtID(i.cost_per_unit)}/{i.unit}{i.assumed_daily_usage > 0 ? ` · asumsi ${fmtQty(i.assumed_daily_usage)}/hari` : ''}</p>
                    </div>
                    <div className="flex gap-1">
                      <IconButton
                        label={i.low_stock_alert ? `Notifikasi stok aktif: ${i.name}` : `Notifikasi stok mati: ${i.name}`}
                        size="sm" variant={i.low_stock_alert ? 'success' : 'ghost'}
                        className={i.low_stock_alert ? '' : 'text-muted'}
                        onClick={() => toggleAlert.mutate({ id: i.id, low_stock_alert: !i.low_stock_alert }, {
                          onSuccess: () => toast.info(i.low_stock_alert ? `Notifikasi ${i.name} dimatikan` : `Notifikasi ${i.name} dinyalakan`),
                        })}
                      >
                        {i.low_stock_alert ? <Bell size={15} aria-hidden /> : <BellOff size={15} aria-hidden />}
                      </IconButton>
                      <IconButton label={`Stok masuk ${i.name}`} size="sm" variant="secondary" className="text-green-700 dark:text-green-400" onClick={() => setAdjusting({ ing: i, mode: 'in' })}><ArrowDownToLine size={15} aria-hidden /></IconButton>
                      <IconButton label={`Stok keluar ${i.name}`} size="sm" variant="secondary" className="text-red-600" onClick={() => setAdjusting({ ing: i, mode: 'out' })}><ArrowUpFromLine size={15} aria-hidden /></IconButton>
                      <IconButton label={`Stok opname ${i.name}`} size="sm" variant="secondary" onClick={() => setOpnameFor(i)}><Scale size={15} aria-hidden /></IconButton>
                      <IconButton label={`Edit ${i.name}`} size="sm" variant="secondary" onClick={() => setEditingId(i.id)}><Pencil size={15} aria-hidden /></IconButton>
                      <IconButton label={`Hapus ${i.name}`} size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleting(i)}><Trash2 size={15} aria-hidden /></IconButton>
                    </div>
                  </div>
              </GridCard>
            )
          })}
        </CardGrid>
      )}
      </>)}

      {tab === 'rekomendasi' && (
        <RecommendationView
          ingredients={ingredients} usage={usage}
          products={products} recipes={recipes} packageIngredients={packageIngredients}
          onOrder={(p) => { setPurchasePrefill(p); setPurchaseOpen(true) }}
        />
      )}
      {tab === 'pembelian' && (
        <PurchaseHistory purchases={purchases} onNew={() => { setPurchasePrefill([]); setPurchaseOpen(true) }} />
      )}

      {editingId !== null && editing && <IngredientForm key={editingId} ing={editing} onClose={() => setEditingId(null)} />}
      <AdjustModal state={adjusting} onClose={() => setAdjusting(null)} />
      {opnameFor && <OpnameModal key={opnameFor.id} ing={opnameFor} onClose={() => setOpnameFor(null)} />}
      <MovementsModal open={histOpen} onClose={() => setHistOpen(false)} moves={moves as never} />
      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)}
        title="Hapus bahan baku?" message={`"${deleting?.name}" akan dihapus dari resep dan daftar bahan.`}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => toast.success('Bahan dihapus'), onError: (e: Error) => toast.error(e.message) })}
      />
      <PurchaseModal
        open={purchaseOpen} onClose={() => setPurchaseOpen(false)}
        ingredients={ingredients} prefill={purchasePrefill}
      />
    </Page>
  )
}

// ================= FORM BAHAN (beli vs resep) =================
function IngredientForm({ ing, onClose }: { ing: Partial<Ingredient>; onClose: () => void }) {
  const save = useSaveIngredient()
  const isNew = !ing.id

  const [name, setName] = useState(ing.name || '')
  const [purchasePrice, setPurchasePrice] = useState(ing.purchase_price ? String(ing.purchase_price) : '')
  const [purchaseUnit, setPurchaseUnit] = useState(ing.purchase_unit || 'pack')
  const [purchaseQty, setPurchaseQty] = useState(ing.purchase_qty ? String(ing.purchase_qty) : '1')
  const [recipeUnit, setRecipeUnit] = useState(ing.unit || 'gr')
  const [stock, setStock] = useState(ing.id ? String(ing.stock) : '0')
  const [minStock, setMinStock] = useState(ing.id ? String(ing.min_stock) : '0')
  const [assumedDaily, setAssumedDaily] = useState(ing.assumed_daily_usage ? String(ing.assumed_daily_usage) : '')
  const [alertOn, setAlertOn] = useState(ing.low_stock_alert ?? true)

  const computedCost = costPerRecipeUnit(num(purchasePrice), num(purchaseQty), purchaseUnit, recipeUnit)

  const submit = () => {
    if (!name.trim()) { toast.error('Nama bahan wajib diisi'); return }
    if (!computedCost) {
      toast.error('Satuan beli dan satuan resep harus satu jenis (berat/volume/pcs)');
      return
    }
    save.mutate(
      {
        id: ing.id, name: name.trim(),
        unit: recipeUnit,
        cost_per_unit: Math.round(computedCost),
        purchase_unit: purchaseUnit,
        purchase_qty: num(purchaseQty) || 1,
        purchase_price: num(purchasePrice),
        stock: num(stock), min_stock: num(minStock), assumed_daily_usage: num(assumedDaily),
        low_stock_alert: alertOn, is_active: ing.is_active ?? true,
      },
      { onSuccess: () => { toast.success(isNew ? 'Bahan ditambahkan' : 'Bahan disimpan'); onClose() }, onError: (e: Error) => toast.error(e.message) },
    )
  }

  const unitOptions = (sel: string) => (
    <>
      <optgroup label="Berat">{WEIGHT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</optgroup>
      <optgroup label="Volume">{VOLUME_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</optgroup>
      <optgroup label="Satuan">{ALL_UNITS.filter((u) => !WEIGHT_UNITS.includes(u) && !VOLUME_UNITS.includes(u)).map((u) => <option key={u} value={u}>{u}</option>)}</optgroup>
      {sel && !ALL_UNITS.includes(sel) && <option value={sel}>{sel}</option>}
    </>
  )

  return (
    <Modal open onClose={onClose} title={isNew ? 'Tambah Bahan Baku' : 'Edit Bahan Baku'}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-[2]" onClick={submit} disabled={save.isPending}>Simpan</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nama bahan" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Susu UHT" />
        </Field>

        <div className="rounded-2xl border border-line p-3.5 dark:border-line">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Pembelian</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Harga beli (Rp)" required>
              <Input inputMode="numeric" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value.replace(/\D/g, ''))} placeholder="0" />
            </Field>
            <Field label="Satuan beli">
              <Select value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)}>{unitOptions(purchaseUnit)}</Select>
            </Field>
            <Field label="Jumlah / isi">
              <Input inputMode="decimal" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="1" />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">Contoh: harga 25.000, satuan beli pack, isi 1000, satuan resep ml → 1 kemasan = 1000 ml.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Satuan resep / jual" required hint="Dipakai di resep & stok">
            <Select value={recipeUnit} onChange={(e) => setRecipeUnit(e.target.value)}>{unitOptions(recipeUnit)}</Select>
          </Field>
          <div className="flex items-end">
            <div className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${computedCost ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <Calculator size={16} className={computedCost ? 'text-green-700 dark:text-green-400' : 'text-red-600'} aria-hidden />
              <span className="font-semibold" aria-live="polite">
                {computedCost ? `${fmtID(Math.round(computedCost))}/${recipeUnit}` : 'Satuan tidak cocok'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={isNew ? 'Stok awal' : 'Stok saat ini'} hint={isNew ? undefined : 'Gunakan stok masuk / opname'}>
            <Input inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9.,]/g, ''))} disabled={!isNew} className={isNew ? '' : 'opacity-60'} />
          </Field>
          <Field label="Stok minimum" hint="Batas peringatan stok menipis">
            <Input inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value.replace(/[^0-9.,]/g, ''))} />
          </Field>
        </div>

        <Field label="Asumsi pakai per hari (opsional)" hint={`Cadangan rekomendasi saat data penjualan belum cukup. Satuan ${recipeUnit}.`}>
          <Input inputMode="decimal" value={assumedDaily} onChange={(e) => setAssumedDaily(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="mis. 10" />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3.5 py-3 dark:border-line">
          <div className="flex min-w-0 items-center gap-2.5">
            <Bell size={18} className={alertOn ? 'shrink-0 text-brand-600' : 'shrink-0 text-muted'} aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-bold">Notifikasi stok menipis</p>
              <p className="text-xs text-muted">Peringatan muncul saat stok menyentuh batas minimum</p>
            </div>
          </div>
          <Switch checked={alertOn} onChange={setAlertOn} label="Notifikasi stok menipis" />
        </div>

        {!sameFamilyCompatible(purchaseUnit, recipeUnit) && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" role="alert">
            Catatan: satuan beli & resep beda jenis. Sistem tetap menyimpan, tapi konversi HPP tidak otomatis.
          </p>
        )}
      </div>
    </Modal>
  )
}

const sameFamilyCompatible = (a: string, b: string) => a === b || sameFamily(a, b)

// ================= STOK MASUK/KELUAR =================
function AdjustModal({ state, onClose }: { state: { ing: Ingredient; mode: 'in' | 'out' } | null; onClose: () => void }) {
  const adjust = useAdjustStock()
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  if (!state) return null
  const { ing, mode } = state
  const delta = mode === 'in' ? num(qty) : -num(qty)
  const after = ing.stock + delta

  const submit = () => {
    if (num(qty) <= 0) { toast.error('Jumlah harus lebih dari 0'); return }
    adjust.mutate(
      {
        id: ing.id, delta,
        type: mode === 'in' ? 'purchase' : 'waste',
        note: note || (mode === 'in' ? 'Pembelian' : 'Pemakaian/rusak'),
      },
      { onSuccess: () => { toast.success('Stok diperbarui'); setQty(''); setNote(''); onClose() }, onError: (e: Error) => toast.error(e.message) },
    )
  }

  return (
    <Modal open onClose={onClose} size="sm" title={mode === 'in' ? 'Stok Masuk' : 'Stok Keluar'}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-surface-2 p-4 text-center dark:bg-surface-2">
          <p className="text-sm font-bold">{ing.name}</p>
          <p className="mt-1 text-xs text-muted">
            {fmtQty(ing.stock)} → <strong className={delta < 0 ? 'text-red-600' : 'text-green-700 dark:text-green-400'}>{fmtQty(Math.max(0, after))} {ing.unit}</strong>
          </p>
        </div>
        <Field label={`Jumlah ${mode === 'in' ? 'masuk' : 'keluar'} (${ing.unit})`} required>
          <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0" className="h-14 text-2xl font-bold" />
        </Field>
        <Field label="Catatan (opsional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'in' ? 'mis. beli ke supplier' : 'mis. rusak, terbuang'} />
        </Field>
        <Button size="lg" className="w-full" variant={mode === 'out' ? 'danger' : 'primary'} onClick={submit} disabled={adjust.isPending}>
          {mode === 'in' ? <ArrowDownToLine size={18} aria-hidden /> : <ArrowUpFromLine size={18} aria-hidden />}
          Simpan
        </Button>
      </div>
    </Modal>
  )
}

// ================= STOK OPNAME =================
function OpnameModal({ ing, onClose }: { ing: Ingredient; onClose: () => void }) {
  const adjust = useAdjustStock()
  const [physical, setPhysical] = useState(String(ing.stock))
  const [note, setNote] = useState('')
  const diff = num(physical) - ing.stock

  const submit = () => {
    if (diff === 0) { toast.info('Tidak ada selisih'); onClose(); return }
    adjust.mutate(
      { id: ing.id, delta: diff, type: 'adjustment', note: note || 'Stok opname' },
      { onSuccess: () => { toast.success(`Opname tersimpan — selisih ${diff > 0 ? '+' : ''}${fmtQty(diff)} ${ing.unit}`); onClose() }, onError: (e: Error) => toast.error(e.message) },
    )
  }

  return (
    <Modal open onClose={onClose} size="sm" title="Stok Opname">
      <div className="space-y-4">
        <div className="rounded-2xl bg-surface-2 p-4 text-center dark:bg-surface-2">
          <p className="text-sm font-bold">{ing.name}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div><p className="text-xs text-muted">Sistem</p><p className="font-bold tabular-nums">{fmtQty(ing.stock)}</p></div>
            <div><p className="text-xs text-muted">Fisik</p><p className="font-bold tabular-nums">{fmtQty(num(physical))}</p></div>
            <div><p className="text-xs text-muted">Selisih</p><p className={`font-bold tabular-nums ${diff === 0 ? '' : diff > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>{diff > 0 ? '+' : ''}{fmtQty(diff)}</p></div>
          </div>
        </div>
        <Field label={`Hasil hitung fisik (${ing.unit})`} required>
          <Input inputMode="decimal" value={physical} onChange={(e) => setPhysical(e.target.value.replace(/[^0-9.,]/g, ''))} className="h-14 text-2xl font-bold" />
        </Field>
        <Field label="Catatan (opsional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. opname akhir bulan" />
        </Field>
        <Button size="lg" className="w-full" onClick={submit} disabled={adjust.isPending}>
          <Scale size={18} aria-hidden /> Simpan Opname
        </Button>
      </div>
    </Modal>
  )
}

function MovementsModal({ open, onClose, moves }: { open: boolean; onClose: () => void; moves: Array<{ id: string; type: string; qty: number; stock_after: number; note: string | null; created_at: string; ingredient?: { name: string; unit: string } }> }) {
  const typeLabel: Record<string, string> = { purchase: 'Masuk', usage: 'Pakai (auto)', waste: 'Keluar', adjustment: 'Opname/Sesuai' }
  return (
    <Modal open={open} onClose={onClose} title="Riwayat Pergerakan Stok" size="lg">
      {moves.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Belum ada pergerakan stok.</p>
      ) : (
        <ul className="space-y-1.5" aria-label="Riwayat stok">
          {moves.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-sm dark:border-line">
              <div className="min-w-0">
                <p className="truncate font-semibold">{m.ingredient?.name || '—'}</p>
                <p className="text-xs text-muted">{typeLabel[m.type] || m.type} · {m.note || ''} · {fmtDateTime(m.created_at)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`font-bold tabular-nums ${m.qty >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
                  {m.qty >= 0 ? '+' : ''}{fmtQty(m.qty)} {m.ingredient?.unit}
                </p>
                <p className="text-xs text-muted tabular-nums">sisa {fmtQty(m.stock_after)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
