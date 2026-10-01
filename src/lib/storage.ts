import { supabase } from './supabase'

export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${productId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type,
  })
  if (error) throw error
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

export async function deleteProductImageByUrl(url: string) {
  try {
    const marker = '/product-images/'
    const i = url.indexOf(marker)
    if (i === -1) return
    const path = url.slice(i + marker.length)
    await supabase.storage.from('product-images').remove([path])
  } catch { /* diamkan */ }
}
