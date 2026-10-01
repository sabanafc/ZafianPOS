import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Category, Product, Ingredient, RecipeItem } from '../types'

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

/** Naik/turunkan urutan kategori dengan menukar sort_order */
export function useMoveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: 'up' | 'down' }) => {
      const { data: all, error } = await supabase.from('categories').select('id, sort_order').order('sort_order')
      if (error) throw error
      const idx = all.findIndex((c: { id: string }) => c.id === id)
      const swapWith = dir === 'up' ? idx - 1 : idx + 1
      if (swapWith < 0 || swapWith >= all.length) return
      const a = all[idx], b = all[swapWith]
      const { error: e1 } = await supabase.from('categories').update({ sort_order: b.sort_order }).eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('categories').update({ sort_order: a.sort_order }).eq('id', b.id)
      if (e2) throw e2
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
