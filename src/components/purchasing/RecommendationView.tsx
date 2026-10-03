import { useMemo, useState } from 'react'
import { ShoppingBasket, AlertTriangle, TrendingUp, FlaskConical, Info, UtensilsCrossed, Layers, Target } from 'lucide-react'
import type { Ingredient, Product, RecipeItem, PackageIngredient } from '../../types'
import { Button, Segmented, Switch, Badge, EmptyState } from '../ui'
import { fmtID, fmtQty } from '../../lib/utils'
import {
  buildPlan, buildMenuPlans, buildTargetUsage, planSummary, HORIZONS,
  type Horizon, type UsageStat, type IngredientPlan, type MenuPlan,
} from '../../lib/purchasing'
import type { PurchasePrefill } from './PurchaseModal'

type Mode = 'bahan' | 'menu'

function daysBadge(plan: IngredientPlan) {
  if (plan.daysLeft === null) return <Badge tone="slate">belum ada data</Badge>
  const d = plan.daysLeft
  const tone = d < 3 ? 'red' : d < 7 ? 'amber' : 'green'
  return <Badge tone={tone}>± {Math.floor(d)} hari</Badge>
}

/** Berapa qty beli yang ditampilkan (kemasan bila ada, jika tidak satuan resep). */
function buyLabel(plan: IngredientPlan) {
  if (plan.packs !== null && plan.pack.hasPack && plan.pack.convertible) {
    return `${fmtQty(plan.packs)} ${plan.pack.packUnit}`
  }
  return `${fmtQty(plan.buyQty)} ${plan.ingredient.unit}`
}

/** Daftar bahan yang perlu dibeli untuk horizon terpilih + estimasi biaya. */
export function RecommendationView({
  ingredients, usage, products, recipes, packageIngredients, onOrder,
}: {
  ingredients: Ingredient[]
  usage: Record<string, UsageStat>
  products: Product[]
  recipes: RecipeItem[]
  packageIngredients: PackageIngredient[]
  onOrder: (prefill: PurchasePrefill[]) => void
}) {
  const [horizon, setHorizon] = useState<Horizon>(7)
  const [mode, setMode] = useState<Mode>('bahan')
  const [showAll, setShowAll] = useState(false)

  const targetUsage = useMemo(
    () => buildTargetUsage(products, recipes, packageIngredients),
    [products, recipes, packageIngredients],
  )
  const plans = useMemo(() => buildPlan(ingredients, usage, horizon, targetUsage), [ingredients, usage, horizon, targetUsage])
  const summary = useMemo(() => planSummary(plans), [plans])
  const menus = useMemo(
    () => buildMenuPlans(products, recipes, packageIngredients, plans),
    [products, recipes, packageIngredients, plans],
  )

  const visibleIngredients = showAll ? plans : plans.filter((p) => p.recommended)
  const visibleMenus = showAll ? menus : menus.filter((m) => m.needsRestock)
  const menusToRestock = menus.filter((m) => m.needsRestock).length
  const coreShortMenus = menus.filter((m) => m.coreShort).length

  if (ingredients.length === 0) {
    return <EmptyState icon={<ShoppingBasket size={24} />} title="Belum ada bahan baku" subtitle="Tambahkan bahan baku untuk mendapat rekomendasi pembelian." />
  }

  const ingredientPrefill: PurchasePrefill[] = plans
    .filter((p) => p.recommended)
    .map((p) => ({ ingredient_id: p.ingredient.id, qty: p.buyQty }))

  const menuPrefill = (menu: MenuPlan): PurchasePrefill[] =>
    menu.triggers.map((l) => ({ ingredient_id: l.ingredient.id, qty: l.plan.buyQty }))

  return (
    <div className="space-y-4">
      {/* Pilih tampilan: per bahan atau per menu */}
      <Segmented<Mode>
        label="Tampilan rekomendasi" kind="tabs" full
        value={mode} onChange={setMode}
        options={[
          { value: 'bahan', label: 'Per Bahan', icon: <FlaskConical size={15} aria-hidden /> },
          { value: 'menu', label: 'Per Menu/Paket', icon: <UtensilsCrossed size={15} aria-hidden /> },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Horizon pembelian"
          value={horizon}
          onChange={setHorizon}
          options={HORIZONS.map((h) => ({ value: h, label: `${h} hari` }))}
        />
        <div className="flex items-center gap-2.5">
          <span className="text-sm text-muted">{mode === 'bahan' ? 'Semua bahan' : 'Semua menu'}</span>
          <Switch checked={showAll} onChange={setShowAll} label={mode === 'bahan' ? 'Tampilkan semua bahan' : 'Tampilkan semua menu'} />
        </div>
      </div>

      {mode === 'bahan' ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-surface-2 px-4 py-3 text-xs text-muted">
            <span className="flex items-center gap-1.5"><TrendingUp size={14} aria-hidden /> {summary.fromSales} bahan dari data penjualan</span>
            <span className="flex items-center gap-1.5"><Target size={14} aria-hidden /> {summary.fromTarget} bahan dari target menu</span>
            <span className="flex items-center gap-1.5"><FlaskConical size={14} aria-hidden /> {summary.fromAssumption} bahan dari asumsi</span>
            {summary.noData > 0 && <span className="flex items-center gap-1.5"><Info size={14} aria-hidden /> {summary.noData} bahan belum ada data</span>}
          </div>

          {visibleIngredients.length === 0 ? (
            <EmptyState
              icon={<ShoppingBasket size={24} />}
              title="Stok masih aman"
              subtitle={`Semua bahan cukup untuk ${horizon} hari ke depan dan di atas stok minimum.`}
            />
          ) : (
            <ul aria-label="Rekomendasi pembelian" className="space-y-2">
              {visibleIngredients.map((plan) => {
                const i = plan.ingredient
                return (
                  <li
                    key={i.id}
                    className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-2xl border border-line bg-surface px-4 py-3 ${!plan.recommended ? 'opacity-70' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        <span className="truncate">{i.name}</span>
                        {plan.belowMin && <Badge tone="red"><AlertTriangle size={12} aria-hidden /> minimum</Badge>}
                        {plan.source === 'target' && <Badge tone="brand"><Target size={12} aria-hidden /> target menu</Badge>}
                        {plan.source === 'assumption' && <Badge tone="amber">asumsi</Badge>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        stok {fmtQty(i.stock)} {i.unit}
                        {plan.dailyUsage > 0 && <> · pakai ± {fmtQty(plan.dailyUsage)} {i.unit}/hari</>}
                        {plan.source === 'none' && <> · isi asumsi pemakaian atau tunggu data penjualan</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {daysBadge(plan)}
                      <div className="text-right">
                        {plan.recommended ? (
                          <>
                            <p className="font-bold tabular-nums">+{buyLabel(plan)}</p>
                            <p className="text-xs text-muted tabular-nums">± {fmtID(plan.estCost)}</p>
                          </>
                        ) : (
                          <p className="text-sm text-muted">cukup</p>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {summary.recommended > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{summary.recommended} bahan perlu dibeli untuk {horizon} hari</p>
                <p className="text-xs text-muted">Estimasi biaya ± {fmtID(summary.estCost)}</p>
              </div>
              <Button onClick={() => onOrder(ingredientPrefill)}>
                <ShoppingBasket size={17} aria-hidden /> Catat Pembelian
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-surface-2 px-4 py-3 text-xs text-muted">
            <span className="flex items-center gap-1.5"><UtensilsCrossed size={14} aria-hidden /> {menusToRestock} menu/paket perlu ditambah bahan</span>
            <span className="flex items-center gap-1.5"><AlertTriangle size={14} aria-hidden /> {coreShortMenus} menu bahan intinya menipis</span>
          </div>

          {menus.length === 0 ? (
            <EmptyState
              icon={<UtensilsCrossed size={24} />}
              title="Belum ada menu beresep"
              subtitle="Susun resep menu atau paket agar bahan pelengkapnya bisa dikelompokkan otomatis."
            />
          ) : visibleMenus.length === 0 ? (
            <EmptyState
              icon={<ShoppingBasket size={24} />}
              title="Menu masih aman"
              subtitle={`Semua bahan menu cukup untuk ${horizon} hari ke depan.`}
            />
          ) : (
            <ul aria-label="Rekomendasi per menu" className="space-y-3">
              {visibleMenus.map((menu) => (
                <li key={menu.product.id} className={`rounded-card border border-line bg-surface p-4 ${!menu.needsRestock ? 'opacity-70' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        <span className="truncate">{menu.product.name}</span>
                        {menu.isPackage
                          ? <Badge tone="brand"><Layers size={12} aria-hidden /> paket</Badge>
                          : <Badge tone="slate">menu</Badge>}
                        {menu.coreShort && <Badge tone="red"><AlertTriangle size={12} aria-hidden /> bahan inti menipis</Badge>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {menu.triggers.length} dari {menu.lines.length} bahan perlu dibeli
                        {menu.core && <> · bahan inti: {menu.core.ingredient.name}</>}
                        {menu.product.daily_target > 0 && <> · target {fmtQty(menu.product.daily_target)} porsi/hari</>}
                      </p>
                    </div>
                    {menu.needsRestock && (
                      <p className="text-sm text-muted tabular-nums">estimasi ± {fmtID(menu.estCost)}</p>
                    )}
                  </div>

                  <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                    {menu.lines.map((l) => (
                      <li key={l.ingredient.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                        <span className="min-w-0">
                          <span className={`font-medium ${l.plan.recommended ? '' : 'text-muted'}`}>{l.ingredient.name}</span>
                          <span className="ml-1.5 text-xs text-muted tabular-nums">{fmtQty(l.qtyPerPortion)} {l.ingredient.unit}/porsi</span>
                        </span>
                        <span className="flex items-center gap-3">
                          {daysBadge(l.plan)}
                          {l.plan.recommended
                            ? <span className="font-bold tabular-nums">+{buyLabel(l.plan)}</span>
                            : <span className="text-xs text-muted">cukup</span>}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {menu.needsRestock && (
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => onOrder(menuPrefill(menu))}>
                        <ShoppingBasket size={15} aria-hidden /> Catat Pembelian
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-muted">
            Jumlah tiap bahan mengikuti kebutuhan total untuk {horizon} hari (bukan per porsi menu), jadi bahan yang dipakai beberapa menu tidak dihitung dua kali.
          </p>
        </>
      )}
    </div>
  )
}
