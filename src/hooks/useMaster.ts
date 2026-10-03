import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Category, Product, Ingredient, RecipeItem, PackageItem, PackageIngredient } from '../types'

// ---------- Kategori ----------
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order')
      if (error) throw error
      return data as Category[]
    },
    staleTime: 60_000,
  })
}

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: Partial<Category> & { name: string }) => {
      const { error } = c.id
        ? await supabase.from('categories').update(c).eq('id', c.id)
        : await supabase.from('categories').insert(c)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

/** Simpan urutan kategori baru (dipakai drag & drop di halaman Menu) */
export function useReorderCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // tulis ulang sort_order 0..n-1 sesuai posisi baru
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase.from('categories').update({ sort_order: i }).eq('id', orderedIds[i])
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

/** Toggle tampil/sembunyi produk di kasir */
export function useToggleProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('products').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

// ---------- Produk ----------
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase.from('products').select('*').order('name')
      if (error) throw error
      return data as Product[]
    },
    staleTime: 60_000,
  })
}

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: Partial<Product> & { name: string; price: number }) => {
      const payload = {
        name: p.name,
        price: p.price,
        category_id: p.category_id || null,
        image_url: p.image_url || null,
        is_active: p.is_active ?? true,
        stock: p.stock ?? 0,
        min_stock: p.min_stock ?? 0,
        track_stock: p.track_stock ?? false,
        is_package: p.is_package ?? false,
        daily_target: p.daily_target ?? 0,
      }
      const { error } = p.id
        ? await supabase.from('products').update(payload).eq('id', p.id)
        : await supabase.from('products').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

// ---------- Import CSV ----------
export interface ImportResult { inserted: number; updated: number }

export function useImportProducts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: Array<{ name: string; price: number; category?: string | null; is_active?: boolean }>): Promise<ImportResult> => {
      const names = rows.map((r) => r.name)
      const { data: existing, error: e1 } = await supabase.from('products').select('id, name').in('name', names)
      if (e1) throw e1
      const map = new Map((existing as Array<{ id: string; name: string }>).map((p) => [p.name.trim().toLowerCase(), p.id]))

      // kategori: buat bila belum ada
      const catNames = [...new Set(rows.map((r) => r.category?.trim()).filter(Boolean) as string[])]
      const catMap = new Map<string, string>()
      if (catNames.length) {
        const { data: cats, error: e2 } = await supabase.from('categories').select('id, name').in('name', catNames)
        if (e2) throw e2
        for (const c of cats as Array<{ id: string; name: string }>) catMap.set(c.name.toLowerCase(), c.id)
        const missing = catNames.filter((n) => !catMap.has(n.toLowerCase()))
        if (missing.length) {
          const base = await supabase.from('categories').select('sort_order').order('sort_order', { ascending: false }).limit(1)
          let next = ((base.data?.[0] as { sort_order?: number } | undefined)?.sort_order ?? 0) + 1
          for (const n of missing) {
            const { data: ins, error: e3 } = await supabase.from('categories').insert({ name: n, sort_order: next++ }).select('id').single()
            if (e3) throw e3
            catMap.set(n.toLowerCase(), (ins as { id: string }).id)
          }
        }
      }

      let inserted = 0, updated = 0
      for (const r of rows) {
        const payload = {
          name: r.name.trim(),
          price: r.price,
          category_id: r.category ? catMap.get(r.category.trim().toLowerCase()) ?? null : null,
          is_active: r.is_active ?? true,
        }
        const id = map.get(r.name.trim().toLowerCase())
        const { error } = id
          ? await supabase.from('products').update(payload).eq('id', id)
        : await supabase.from('products').insert(payload)
        if (error) throw error
        id ? updated++ : inserted++
      }
      return { inserted, updated }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useImportIngredients() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: Array<{
      name: string; unit: string; stock: number; min_stock: number
      purchase_price: number; purchase_unit: string; purchase_qty: number; cost_per_unit: number
    }>): Promise<ImportResult> => {
      const names = rows.map((r) => r.name)
      const { data: existing, error: e1 } = await supabase.from('ingredients').select('id, name, stock').in('name', names)
      if (e1) throw e1
      const map = new Map((existing as Array<{ id: string; name: string; stock: number }>).map((i) => [i.name.trim().toLowerCase(), i]))

      let inserted = 0, updated = 0
      for (const r of rows) {
        const prev = map.get(r.name.trim().toLowerCase())
        if (prev) {
          // update master + stok absolut sesuai CSV
          const { error } = await supabase.from('ingredients').update({
            unit: r.unit, min_stock: r.min_stock, cost_per_unit: r.cost_per_unit,
            purchase_price: r.purchase_price, purchase_unit: r.purchase_unit, purchase_qty: r.purchase_qty,
            stock: r.stock,
          }).eq('id', prev.id)
          if (error) throw error
          updated++
        } else {
          const { error } = await supabase.from('ingredients').insert({
            name: r.name.trim(), unit: r.unit, stock: r.stock, min_stock: r.min_stock,
            cost_per_unit: r.cost_per_unit, purchase_price: r.purchase_price,
            purchase_unit: r.purchase_unit, purchase_qty: r.purchase_qty,
          })
          if (error) throw error
          inserted++
        }
      }
      return { inserted, updated }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['stock-movements'] })
    },
  })
}

/** Import resep (BOM) per menu: baris "menu, bahan, jumlah". Resep menu
 *  yang ada di CSV diganti seluruhnya; menu/bahan tak dikenal dilewati. */
export function useImportRecipes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: Array<{ product: string; ingredient: string; qty: number }>): Promise<ImportResult & { missing: string[] }> => {
      const [prodRes, ingRes] = await Promise.all([
        supabase.from('products').select('id, name'),
        supabase.from('ingredients').select('id, name'),
      ])
      if (prodRes.error) throw prodRes.error
      if (ingRes.error) throw ingRes.error
      const pMap = new Map((prodRes.data as Array<{ id: string; name: string }>).map((p) => [p.name.trim().toLowerCase(), p.id]))
      const iMap = new Map((ingRes.data as Array<{ id: string; name: string }>).map((i) => [i.name.trim().toLowerCase(), i.id]))

      const missing = new Set<string>()
      const byProduct = new Map<string, Map<string, number>>() // productId -> ingredientId -> total qty
      for (const r of rows) {
        const pid = pMap.get(r.product.trim().toLowerCase())
        const iid = iMap.get(r.ingredient.trim().toLowerCase())
        if (!pid) { missing.add(`menu "${r.product}"`); continue }
        if (!iid) { missing.add(`bahan "${r.ingredient}"`); continue }
        if (!byProduct.has(pid)) byProduct.set(pid, new Map())
        const m = byProduct.get(pid)! // jumlah duplikat dijumlahkan
        m.set(iid, (m.get(iid) || 0) + r.qty)
      }

      let inserted = 0, updated = 0
      for (const [pid, items] of byProduct) {
        const { error: delErr } = await supabase.from('recipe_items').delete().eq('product_id', pid)
        if (delErr) throw delErr
        const payload = [...items.entries()].map(([ingredient_id, qty]) => ({ product_id: pid, ingredient_id, qty }))
        if (payload.length) {
          const { error: insErr } = await supabase.from('recipe_items').insert(payload)
          if (insErr) throw insErr
          inserted += payload.length
        }
        updated++
      }
      return { inserted, updated, missing: [...missing] }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] })
      qc.invalidateQueries({ queryKey: ['recipe-all'] })
    },
  })
}

// ---------- Bahan baku ----------
export function useIngredients() {
  return useQuery({
    queryKey: ['ingredients'],
    queryFn: async (): Promise<Ingredient[]> => {
      const { data, error } = await supabase.from('ingredients').select('*').order('name')
      if (error) throw error
      return data as Ingredient[]
    },
    staleTime: 30_000,
  })
}

export function useSaveIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: Partial<Ingredient> & { name: string }) => {
      const payload = {
        name: i.name, unit: i.unit || 'pcs', stock: i.stock || 0,
        min_stock: i.min_stock || 0, cost_per_unit: i.cost_per_unit || 0,
        purchase_unit: i.purchase_unit || i.unit || 'pcs',
        purchase_qty: i.purchase_qty || 1,
        purchase_price: i.purchase_price || 0,
        low_stock_alert: i.low_stock_alert ?? true,
        assumed_daily_usage: i.assumed_daily_usage ?? 0,
        is_active: i.is_active ?? true,
      }
      const { error } = i.id
        ? await supabase.from('ingredients').update(payload).eq('id', i.id)
        : await supabase.from('ingredients').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['stock-movements'] })
    },
  })
}

export function useDeleteIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ingredients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

/** Toggle aktif/nonaktif bahan baku */
export function useToggleIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('ingredients').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['recipe-all'] })
    },
  })
}

/** Toggle notifikasi stok menipis per bahan */
export function useToggleStockAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, low_stock_alert }: { id: string; low_stock_alert: boolean }) => {
      const { error } = await supabase.from('ingredients').update({ low_stock_alert }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  })
}

/** Ubah stok bahan baku (masuk/keluar/penyesuaian) + catat riwayat */
export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, delta, type, note }: { id: string; delta: number; type: 'purchase' | 'adjustment' | 'waste'; note?: string }) => {
      // baca stok terkini
      const { data: ing, error: e1 } = await supabase.from('ingredients').select('stock').eq('id', id).single()
      if (e1) throw e1
      const after = (ing.stock || 0) + delta
      const { error: e2 } = await supabase.from('ingredients').update({ stock: after }).eq('id', id)
      if (e2) throw e2
      const { error: e3 } = await supabase.from('stock_movements').insert({
        ingredient_id: id, type, qty: delta, stock_after: after, note: note || null,
      })
      if (e3) throw e3
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['stock-movements'] })
    },
  })
}

// ---------- Resep / BOM ----------
export function useRecipe(productId?: string) {
  return useQuery({
    queryKey: ['recipes', productId],
    enabled: !!productId,
    queryFn: async (): Promise<RecipeItem[]> => {
      const { data, error } = await supabase
        .from('recipe_items')
        .select('*, ingredient:ingredients(*)')
        .eq('product_id', productId!)
      if (error) throw error
      return (data as any[]).map((d) => ({ ...d, ingredient: d.ingredient as Ingredient })) as RecipeItem[]
    },
  })
}

export function useSetRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, items }: { productId: string; items: Array<{ ingredient_id: string; qty: number }> }) => {
      const del = await supabase.from('recipe_items').delete().eq('product_id', productId)
      if (del.error) throw del.error
      if (items.length) {
        const ins = await supabase.from('recipe_items').insert(items.map((it) => ({ ...it, product_id: productId })))
        if (ins.error) throw ins.error
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['recipes'] })
      qc.invalidateQueries({ queryKey: ['recipe-all'] })
    },
  })
}

/** Semua resep sekaligus — untuk hitung HPP semua produk */
export function useAllRecipes() {
  return useQuery({
    queryKey: ['recipe-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('recipe_items').select('*, ingredient:ingredients(*)')
      if (error) throw error
      return data as RecipeItem[]
    },
  })
}

// ---------- Stok menu (manual) ----------
/** Tambah/kurangi stok menu secara manual (mis. hasil produksi, opname). */
export function useAdjustProductStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, delta, track_stock }: { id: string; delta: number; track_stock?: boolean }) => {
      const { data: prod, error: e1 } = await supabase.from('products').select('stock').eq('id', id).single()
      if (e1) throw e1
      const after = ((prod as { stock: number }).stock || 0) + delta
      const patch: Record<string, unknown> = { stock: after }
      if (track_stock !== undefined) patch.track_stock = track_stock
      const { error: e2 } = await supabase.from('products').update(patch).eq('id', id)
      if (e2) throw e2
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

// ---------- Paket menu ----------
export function usePackageItems(packageId?: string) {
  return useQuery({
    queryKey: ['package-items', packageId],
    enabled: !!packageId,
    queryFn: async (): Promise<PackageItem[]> => {
      const { data, error } = await supabase.from('package_items').select('*').eq('package_id', packageId!)
      if (error) throw error
      return data as PackageItem[]
    },
  })
}

/** Semua komposisi paket sekaligus — untuk hitung HPP paket di daftar menu. */
export function useAllPackageItems() {
  return useQuery({
    queryKey: ['package-items-all'],
    queryFn: async (): Promise<PackageItem[]> => {
      const { data, error } = await supabase.from('package_items').select('*')
      if (error) throw error
      return data as PackageItem[]
    },
  })
}

export function useSetPackageItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ packageId, items }: { packageId: string; items: Array<{ component_id: string; qty: number }> }) => {
      const del = await supabase.from('package_items').delete().eq('package_id', packageId)
      if (del.error) throw del.error
      if (items.length) {
        const ins = await supabase.from('package_items').insert(items.map((it) => ({ ...it, package_id: packageId })))
        if (ins.error) throw ins.error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['package-items'] })
      qc.invalidateQueries({ queryKey: ['package-items-all'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product-sales'] })
    },
  })
}

export function usePackageIngredients(packageId?: string) {
  return useQuery({
    queryKey: ['package-ingredients', packageId],
    enabled: !!packageId,
    queryFn: async (): Promise<PackageIngredient[]> => {
      const { data, error } = await supabase
        .from('package_ingredients')
        .select('*, ingredient:ingredients(*)')
        .eq('package_id', packageId!)
      if (error) throw error
      return (data as any[]).map((d) => ({ ...d, ingredient: d.ingredient as Ingredient })) as PackageIngredient[]
    },
  })
}

export function useAllPackageIngredients() {
  return useQuery({
    queryKey: ['package-ingredients-all'],
    queryFn: async (): Promise<PackageIngredient[]> => {
      const { data, error } = await supabase.from('package_ingredients').select('*, ingredient:ingredients(*)')
      if (error) throw error
      return (data as any[]).map((d) => ({ ...d, ingredient: d.ingredient as Ingredient })) as PackageIngredient[]
    },
  })
}

export function useSetPackageIngredients() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ packageId, items }: { packageId: string; items: Array<{ ingredient_id: string; qty: number; source?: string | null; note?: string | null }> }) => {
      const del = await supabase.from('package_ingredients').delete().eq('package_id', packageId)
      if (del.error) throw del.error
      const clean = items.filter((it) => it.ingredient_id && it.qty > 0)
      if (clean.length) {
        const ins = await supabase.from('package_ingredients').insert(
          clean.map((it) => ({ package_id: packageId, ingredient_id: it.ingredient_id, qty: it.qty, source: it.source ?? null, note: it.note ?? null })),
        )
        if (ins.error) throw ins.error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['package-ingredients'] })
      qc.invalidateQueries({ queryKey: ['package-ingredients-all'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

/** Total qty terjual per produk (order berstatus paid) —
 *  dipakai untuk menyortir menu terlaris di halaman kasir.
 *  days = periode (7/30/90); 0 = semua waktu. */
export function useProductSales(days = 30) {
  return useQuery({
    queryKey: ['product-sales', days],
    queryFn: async (): Promise<Map<string, number>> => {
      let q = supabase
        .from('order_items')
        .select('product_id, qty, orders!inner(status, created_at)')
        .eq('orders.status', 'paid')
      if (days > 0) q = q.gte('orders.created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      const { data, error } = await q
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data as Array<{ product_id: string | null; qty: number }>) {
        if (r.product_id) m.set(r.product_id, (m.get(r.product_id) || 0) + (r.qty || 0))
      }
      return m
    },
    staleTime: 60_000,
  })
}
