import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Ingredient } from '../../types'
import { Modal } from '../Modal'
import { Button, IconButton, Input, Select, Field } from '../ui'
import { fmtID, fmtQty, num } from '../../lib/utils'
import { packInfo } from '../../lib/purchasing'
import { useSavePurchase } from '../../hooks/usePurchases'
import { toast } from '../../lib/toast'

interface Row { key: number; ingredient_id: string; packs: string; price: string }

export interface PurchasePrefill {
  /** qty dalam satuan resep (mis. hasil rekomendasi) */
  ingredient_id: string
  qty: number
}

let seq = 0
const blankRow = (): Row => ({ key: ++seq, ingredient_id: '', packs: '1', price: '' })

/** Susun baris awal dari prefill rekomendasi (qty satuan resep → kemasan). */
function buildRows(prefill: PurchasePrefill[], ingredients: Ingredient[]): Row[] {
  if (!prefill.length) return [blankRow()]
  const rows = prefill.map((p) => {
    const ing = ingredients.find((i) => i.id === p.ingredient_id)
    if (!ing || p.qty <= 0) return blankRow()
    const info = packInfo(ing)
    const packs = info.hasPack && info.convertible ? Math.max(1, Math.ceil(p.qty / info.perPack)) : Math.max(1, Math.ceil(p.qty))
    return { key: ++seq, ingredient_id: ing.id, packs: String(packs), price: String(info.pricePerPack) }
  })
  return rows.length ? rows : [blankRow()]
}

/** Catat pembelian bahan: satu nota bisa berisi beberapa bahan sekaligus. */
export function PurchaseModal({
  open, onClose, ingredients, prefill = [],
}: {
  open: boolean
  onClose: () => void
  ingredients: Ingredient[]
  prefill?: PurchasePrefill[]
}) {
  const save = useSavePurchase()
  const [supplier, setSupplier] = useState('')
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<Row[]>([blankRow()])

  // Segarkan isian tiap kali dialog dibuka (dengan prefill terbaru)
  useEffect(() => {
    if (open) {
      setSupplier('')
      setNote('')
      setRows(buildRows(prefill, ingredients))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const active = useMemo(() => ingredients.filter((i) => i.is_active), [ingredients])

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))

  const onPickIngredient = (key: number, id: string) => {
    const ing = ingredients.find((i) => i.id === id)
    const price = ing ? String(packInfo(ing).pricePerPack) : ''
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ingredient_id: id, price } : r)))
  }

  const computed = rows.map((r) => {
    const ing = ingredients.find((i) => i.id === r.ingredient_id)
    if (!ing) return { row: r, ing: null as Ingredient | null, info: null, recipeQty: 0, unitCost: 0, lineTotal: 0 }
    const info = packInfo(ing)
    const packs = num(r.packs)
    const price = num(r.price)
    const recipeQty = packs * info.perPack
    const unitCost = info.perPack > 0 ? price / info.perPack : 0
    return { row: r, ing, info, recipeQty, unitCost, lineTotal: packs * price }
  })

  const total = computed.reduce((s, c) => s + (c.ing ? c.lineTotal : 0), 0)

  const submit = () => {
    const items = computed
      .filter((c) => c.ing && c.recipeQty > 0)
      .map((c) => ({
        ingredient_id: c.ing!.id,
        qty: c.recipeQty,
        unit_cost: c.unitCost,
        purchase_unit: c.ing!.purchase_unit,
        purchase_qty: c.ing!.purchase_qty,
        purchase_price: num(c.row.price) || null,
      }))
    if (!items.length) { toast.error('Tambahkan minimal satu bahan'); return }
    save.mutate(
      { supplier: supplier.trim() || null, note: note.trim() || null, items },
      {
        onSuccess: () => { toast.success('Pembelian tersimpan — stok diperbarui'); onClose() },
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Catat Pembelian Bahan" size="lg"
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Total pembelian</span>
            <span className="text-lg font-bold tabular-nums">{fmtID(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
            <Button className="flex-[2]" onClick={submit} disabled={save.isPending}>Simpan Pembelian</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Supplier (opsional)">
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="mis. Pasar Induk" />
          </Field>
          <Field label="Catatan (opsional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. belanja pagi" />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Rincian bahan</p>
            <Button size="sm" variant="secondary" onClick={() => setRows((rs) => [...rs, blankRow()])}>
              <Plus size={15} aria-hidden /> Bahan
            </Button>
          </div>

          {computed.map((c) => {
            const packUnit = c.info?.packUnit || c.ing?.unit || 'unit'
            return (
              <div key={c.row.key} className="rounded-2xl border border-line p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      aria-label="Pilih bahan"
                      value={c.row.ingredient_id}
                      onChange={(e) => onPickIngredient(c.row.key, e.target.value)}
                    >
                      <option value="">— pilih bahan —</option>
                      {active.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                  </div>
                  <IconButton
                    label="Hapus baris" size="md" variant="ghost" className="text-red-500"
                    onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== c.row.key) : [blankRow()]))}
                  >
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </div>

                {c.ing && (
                  <>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Jumlah ({packUnit})</span>
                        <Input inputMode="decimal" value={c.row.packs} onChange={(e) => patch(c.row.key, { packs: e.target.value.replace(/[^0-9.,]/g, '') })} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Harga / {packUnit} (Rp)</span>
                        <Input inputMode="numeric" value={c.row.price} onChange={(e) => patch(c.row.key, { price: e.target.value.replace(/\D/g, '') })} placeholder="0" />
                      </label>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted">
                        {c.info?.hasPack && c.info.convertible
                          ? `1 ${packUnit} = ${fmtQty(c.info.perPack)} ${c.ing.unit} · total ${fmtQty(c.recipeQty)} ${c.ing.unit}`
                          : `total ${fmtQty(c.recipeQty)} ${c.ing.unit}`}
                      </span>
                      <span className="font-bold tabular-nums">{fmtID(c.lineTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-xs text-muted">
          Stok bahan bertambah otomatis dan HPP diperbarui dengan rata-rata tertimbang. Isi jumlah dalam satuan beli (kemasan) sesuai harga belinya.
        </p>
      </div>
    </Modal>
  )
}
