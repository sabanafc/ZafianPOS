// Satuan berbobot
export const WEIGHT_UNITS = ['mg', 'gr', 'ons', 'kg', 'ton']
// Satuan volume
export const VOLUME_UNITS = ['ml', 'cl', 'l']
// Satuan satuan/pcs
export const UNIT_UNITS = ['pcs', 'pack', 'lusin', 'karton', 'botol', 'kaleng', 'sachet', 'bungkus', 'kotak', 'porsi', 'butir', 'lembar', 'roll', 'cup', 'gelas', 'tangkai', 'ikat']

export const ALL_UNITS = [...WEIGHT_UNITS, ...VOLUME_UNITS, ...UNIT_UNITS]

/** Faktor konversi ke satuan dasar (gr / ml / pcs) dalam satu keluarga */
const TO_BASE: Record<string, number> = {
  mg: 0.001, gr: 1, ons: 100, kg: 1000, ton: 1_000_000,
  ml: 1, cl: 10, l: 1000,
  pcs: 1, pack: 1, lusin: 12, karton: 1, botol: 1, kaleng: 1, sachet: 1, bungkus: 1,
  kotak: 1, porsi: 1, butir: 1, lembar: 1, roll: 1, cup: 1, gelas: 1, tangkai: 1, ikat: 1,
}

export const sameFamily = (a: string, b: string) => {
  const fam = (u: string) =>
    WEIGHT_UNITS.includes(u) ? 'w' : VOLUME_UNITS.includes(u) ? 'v' : 'u'
  return fam(a) === fam(b)
}

/** Konversi qty dari satuan beli → satuan resep. Null bila tak bisa dikonversi. */
export function convertPurchaseToRecipe(purchaseQty: number, purchaseUnit: string, recipeUnit: string): number | null {
  if (!purchaseUnit || !recipeUnit) return null
  if (purchaseUnit === recipeUnit) return purchaseQty
  if (!sameFamily(purchaseUnit, recipeUnit)) return null
  const from = TO_BASE[purchaseUnit] ?? 1
  const to = TO_BASE[recipeUnit] ?? 1
  return (purchaseQty * from) / to
}

/** Harga per satuan resep dari harga beli kemasan */
export function costPerRecipeUnit(purchasePrice: number, purchaseQty: number, purchaseUnit: string, recipeUnit: string): number | null {
  if (purchaseQty <= 0) return null
  const converted = convertPurchaseToRecipe(purchaseQty, purchaseUnit, recipeUnit)
  if (converted === null || converted <= 0) return null
  return purchasePrice / converted
}
