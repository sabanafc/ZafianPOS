import type { Ingredient, Product, RecipeItem, PackageIngredient } from '../types'
import { convertPurchaseToRecipe } from './units'

/**
 * Rekomendasi pembelian bahan baku.
 *
 * Pemakaian harian tiap bahan ditentukan "campuran":
 *  1. dari data penjualan (rata-rata pemakaian nyata per hari), bila sudah cukup;
 *  2. dari target penjualan harian tiap menu/paket (dikalikan resep);
 *  3. cadangan asumsi manual per bahan (`assumed_daily_usage`) untuk masa awal
 *     saat data penjualan belum ada.
 *
 * Rekomendasi selalu membandingkan tiga horizon (3, 5, 7 hari) dan juga
 * mengangkat bahan yang stoknya sudah menyentuh `min_stock` walau horizon
 * stoknya masih panjang.
 */

export const HORIZONS = [3, 5, 7] as const
export type Horizon = (typeof HORIZONS)[number]

/** Jendela hari untuk menghitung rata-rata pemakaian dari penjualan. */
export const DEFAULT_WINDOW_DAYS = 14
/** Minimal jumlah hari berbeda yang ada penjualan agar data dianggap cukup. */
export const MIN_ACTIVE_DAYS = 2

export interface UsageStat {
  /** total pemakaian (positif) dalam satuan resep selama jendela */
  total: number
  /** jumlah hari berbeda yang punya pemakaian */
  activeDays: number
  /** panjang jendela (hari) */
  windowDays: number
}

export type UsageSource = 'sales' | 'target' | 'assumption' | 'none'

export interface PackInfo {
  packUnit: string
  perPack: number
  pricePerPack: number
  /** true bila satuan beli bisa dikonversi ke satuan resep */
  convertible: boolean
  /** true bila bahan punya info kemasan beli */
  hasPack: boolean
}

export interface IngredientPlan {
  ingredient: Ingredient
  dailyUsage: number
  source: UsageSource
  /** sisa hari sebelum stok habis; null bila pemakaian tak diketahui */
  daysLeft: number | null
  /** stok sudah menyentuh / di bawah minimum */
  belowMin: boolean
  recommended: boolean
  /** jumlah beli untuk horizon terpilih, dalam satuan resep */
  buyQty: number
  /** perkiraan jumlah kemasan (bila satuan beli diketahui) */
  packs: number | null
  pack: PackInfo
  /** perkiraan biaya pembelian */
  estCost: number
}

/** Info kemasan beli sebuah bahan (satuan beli, isi, harga per kemasan). */
export function packInfo(ing: Ingredient): PackInfo {
  const hasPack = !!ing.purchase_unit
  const packUnit = ing.purchase_unit || ing.unit
  const packSize = ing.purchase_qty || 1
  const converted = convertPurchaseToRecipe(packSize, packUnit, ing.unit)
  const convertible = converted !== null && converted > 0
  const perPack = convertible ? converted : packSize
  const pricePerPack = ing.purchase_price && ing.purchase_price > 0
    ? ing.purchase_price
    : Math.round(ing.cost_per_unit * perPack)
  return { packUnit, perPack, pricePerPack, convertible, hasPack }
}

/** Berapa kemasan yang perlu dibeli agar setara `recipeQty` satuan resep. */
export function qtyToPacks(ing: Ingredient, recipeQty: number): number | null {
  const info = packInfo(ing)
  if (!info.convertible || info.perPack <= 0) return null
  return Math.ceil(recipeQty / info.perPack)
}

/** Tentukan pemakaian harian sebuah bahan (data penjualan → asumsi → nol). */
export function resolveDailyUsage(ing: Ingredient, stat?: UsageStat, targetDaily?: number): { daily: number; source: UsageSource } {
  if (stat && stat.total > 0 && stat.activeDays >= MIN_ACTIVE_DAYS) {
    return { daily: stat.total / stat.windowDays, source: 'sales' }
  }
  if ((targetDaily || 0) > 0) {
    return { daily: targetDaily as number, source: 'target' }
  }
  if ((ing.assumed_daily_usage || 0) > 0) {
    return { daily: ing.assumed_daily_usage, source: 'assumption' }
  }
  return { daily: 0, source: 'none' }
}

/**
 * Hitung rencana pembelian untuk satu horizon.
 * Target stok = pemakaian horizon + stok minimum (reorder point),
 * jumlah beli = target − stok saat ini (tidak pernah negatif).
 */
export function buildPlan(
  ingredients: Ingredient[],
  usage: Record<string, UsageStat>,
  horizon: Horizon,
  targetUsage: Record<string, number> = {},
): IngredientPlan[] {
  return ingredients
    .filter((i) => i.is_active)
    .map((ing) => {
      const { daily, source } = resolveDailyUsage(ing, usage[ing.id], targetUsage[ing.id])
      const daysLeft = daily > 0 ? ing.stock / daily : null
      const belowMin = ing.stock <= ing.min_stock
      const target = daily * horizon + ing.min_stock
      let buyQty = Math.max(0, target - ing.stock)
      const pack = packInfo(ing)
      // Bahan yang menyentuh / di bawah minimum selalu disarankan, minimal 1 kemasan
      // walau target tercapai (mis. stok tepat sama dengan minimum, pemakaian belum diketahui).
      if (belowMin && buyQty <= 0.001) {
        buyQty = pack.hasPack && pack.convertible && pack.perPack > 0 ? pack.perPack : 1
      }
      const packs = buyQty > 0 && pack.hasPack && pack.convertible ? Math.ceil(buyQty / pack.perPack) : null
      const estCost = packs !== null ? packs * pack.pricePerPack : Math.round(buyQty * ing.cost_per_unit)
      return {
        ingredient: ing,
        dailyUsage: daily,
        source,
        daysLeft,
        belowMin,
        recommended: buyQty > 0.001,
        buyQty,
        packs,
        pack,
        estCost,
      }
    })
    .sort((a, b) => {
      // yang direkomendasikan lebih dulu, lalu sisa hari tersedikit
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1
      const da = a.daysLeft ?? Infinity
      const db = b.daysLeft ?? Infinity
      return da - db
    })
}

/** Berapa banyak bahan yang memakai tiap sumber data (untuk banner info). */
export function planSummary(plans: IngredientPlan[]) {
  const recommended = plans.filter((p) => p.recommended)
  return {
    total: plans.length,
    recommended: recommended.length,
    fromSales: plans.filter((p) => p.source === 'sales').length,
    fromTarget: plans.filter((p) => p.source === 'target').length,
    fromAssumption: plans.filter((p) => p.source === 'assumption').length,
    noData: plans.filter((p) => p.source === 'none').length,
    estCost: recommended.reduce((s, p) => s + p.estCost, 0),
  }
}

// ---------------- Pengelompokan per menu / paket ----------------

export interface MenuPlanLine {
  ingredient: Ingredient
  /** total qty bahan untuk 1 porsi menu (satuan resep) */
  qtyPerPortion: number
  plan: IngredientPlan
}

export interface MenuPlan {
  product: Product
  isPackage: boolean
  lines: MenuPlanLine[]
  /** bahan inti = penyumbang biaya terbesar per porsi */
  core: MenuPlanLine | null
  /** bahan inti menu ini sedang menipis */
  coreShort: boolean
  /** ada bahan (inti atau pelengkap) yang perlu dibeli */
  needsRestock: boolean
  /** bahan yang perlu dibeli (pemicu) */
  triggers: MenuPlanLine[]
  /** perkiraan biaya belanja bahan pemicu menu ini */
  estCost: number
}

/** Kelompokkan qty bahan per produk (resep biasa atau komposisi paket). */
function groupByProduct(recipes: RecipeItem[], packageIngredients: PackageIngredient[]) {
  const sumBy = (rows: Array<{ productId: string; ingredientId: string; qty: number }>) => {
    const m = new Map<string, Map<string, number>>()
    for (const r of rows) {
      let inner = m.get(r.productId)
      if (!inner) { inner = new Map(); m.set(r.productId, inner) }
      inner.set(r.ingredientId, (inner.get(r.ingredientId) || 0) + r.qty)
    }
    return m
  }
  return {
    recipeMap: sumBy(recipes.map((r) => ({ productId: r.product_id, ingredientId: r.ingredient_id, qty: Number(r.qty) || 0 }))),
    pkgMap: sumBy(packageIngredients.map((p) => ({ productId: p.package_id, ingredientId: p.ingredient_id, qty: Number(p.qty) || 0 }))),
  }
}

/**
 * Kelompokkan rekomendasi per menu/paket: ketika bahan inti sebuah menu
 * menipis, bahan pelengkapnya ikut diangkat sebagai satu daftar belanja menu.
 * `plans` = hasil `buildPlan(...)` untuk horizon terpilih.
 */
export function buildMenuPlans(
  products: Product[],
  recipes: RecipeItem[],
  packageIngredients: PackageIngredient[],
  plans: IngredientPlan[],
): MenuPlan[] {
  const planById = new Map(plans.map((p) => [p.ingredient.id, p]))
  const { recipeMap, pkgMap } = groupByProduct(recipes, packageIngredients)

  const out: MenuPlan[] = []
  for (const prod of products) {
    if (!prod.is_active) continue
    const source = prod.is_package ? pkgMap.get(prod.id) : recipeMap.get(prod.id)
    if (!source || source.size === 0) continue

    const lines: MenuPlanLine[] = []
    for (const [iid, qty] of source) {
      const plan = planById.get(iid)
      if (!plan) continue
      lines.push({ ingredient: plan.ingredient, qtyPerPortion: qty, plan })
    }
    if (!lines.length) continue

    const core = lines.reduce((a, b) =>
      b.qtyPerPortion * b.ingredient.cost_per_unit > a.qtyPerPortion * a.ingredient.cost_per_unit ? b : a)
    const triggers = lines.filter((l) => l.plan.recommended)
    out.push({
      product: prod,
      isPackage: prod.is_package,
      lines,
      core,
      coreShort: core.plan.recommended,
      needsRestock: triggers.length > 0,
      triggers,
      estCost: triggers.reduce((s, l) => s + l.plan.estCost, 0),
    })
  }

  // menu yang bahan intinya menipis lebih dulu, lalu yang butuh restock, lalu biaya terbesar
  return out.sort((a, b) => {
    if (a.coreShort !== b.coreShort) return a.coreShort ? -1 : 1
    if (a.needsRestock !== b.needsRestock) return a.needsRestock ? -1 : 1
    return b.estCost - a.estCost
  })
}

/**
 * Pemakaian bahan harian yang diturunkan dari target penjualan tiap menu/paket:
 * target porsi/hari × qty bahan per porsi, dijumlahkan lintas menu.
 * Dipakai sebagai cadangan sebelum ada data penjualan nyata.
 */
export function buildTargetUsage(
  products: Product[],
  recipes: RecipeItem[],
  packageIngredients: PackageIngredient[],
): Record<string, number> {
  const { recipeMap, pkgMap } = groupByProduct(recipes, packageIngredients)
  const out: Record<string, number> = {}
  for (const prod of products) {
    if (!prod.is_active) continue
    const target = prod.daily_target || 0
    if (target <= 0) continue
    const source = prod.is_package ? pkgMap.get(prod.id) : recipeMap.get(prod.id)
    if (!source) continue
    for (const [iid, qty] of source) out[iid] = (out[iid] || 0) + target * qty
  }
  return out
}

// ---------------- Proyeksi omzet & laba dari target ----------------

export interface MenuProjection {
  product: Product
  /** target penjualan harian (porsi) */
  target: number
  /** rata-rata penjualan nyata per hari pada jendela `salesDays` */
  actualDaily: number
  /** actualDaily − target (positif = melebihi target) */
  diff: number
  /** HPP per porsi */
  hpp: number
  /** laba kotor per porsi (harga − HPP) */
  unitProfit: number
  targetRevenue: number
  targetCost: number
  targetProfit: number
  marginPct: number
  actualRevenue: number
  actualProfit: number
}

export interface Projection {
  menus: MenuProjection[]
  /** jumlah menu yang punya target > 0 */
  activeMenus: number
  targetRevenue: number
  targetCost: number
  targetProfit: number
  actualRevenue: number
  actualProfit: number
}

/**
 * Proyeksi harian dari target penjualan tiap menu (target × harga vs HPP)
 * sekaligus perbandingan dengan penjualan nyata. Hanya menu ber-target yang ikut.
 * `sales` = qty terjual per produk pada `salesDays` hari terakhir.
 */
export function buildProjection(
  products: Product[],
  hppMap: Record<string, number>,
  sales: Map<string, number>,
  salesDays: number,
): Projection {
  const menus: MenuProjection[] = products
    .filter((p) => p.is_active && (p.daily_target || 0) > 0)
    .map((p) => {
      const target = p.daily_target || 0
      const hpp = hppMap[p.id] || 0
      const unitProfit = p.price - hpp
      const sold = sales.get(p.id) || 0
      const actualDaily = salesDays > 0 ? sold / salesDays : 0
      return {
        product: p,
        target,
        actualDaily,
        diff: actualDaily - target,
        hpp,
        unitProfit,
        targetRevenue: target * p.price,
        targetCost: target * hpp,
        targetProfit: target * unitProfit,
        marginPct: p.price > 0 ? (unitProfit / p.price) * 100 : 0,
        actualRevenue: actualDaily * p.price,
        actualProfit: actualDaily * unitProfit,
      }
    })
    .sort((a, b) => b.targetRevenue - a.targetRevenue)

  const sum = (pick: (m: MenuProjection) => number) => menus.reduce((s, m) => s + pick(m), 0)
  return {
    menus,
    activeMenus: menus.length,
    targetRevenue: sum((m) => m.targetRevenue),
    targetCost: sum((m) => m.targetCost),
    targetProfit: sum((m) => m.targetProfit),
    actualRevenue: sum((m) => m.actualRevenue),
    actualProfit: sum((m) => m.actualProfit),
  }
}
