import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { resolveTheme, themeVars } from '../lib/themes'
import type { Settings } from '../types'

export function useSettings() {
  const q = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
      if (error) throw error
      return data as Settings
    },
    enabled: isConfigured,
    staleTime: 60_000,
  })
  return { settings: q.data, loading: q.isLoading, error: q.error }
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { error } = await supabase.from('settings').update(patch).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

/** Terapkan tema (mode gelap, preset UI, margin print) ke <html> berdasarkan settings.
 *  Preset UI diubah menjadi variabel CSS — lihat src/lib/themes.ts. */
export function useThemeEffect(settings?: Settings) {
  useEffect(() => {
    const root = document.documentElement
    if (!settings) return
    if (settings.dark_mode) root.classList.add('dark')
    else root.classList.remove('dark')
    // margin print terkalibrasi dari pengaturan
    root.style.setProperty('--print-margin', `${settings.print_margin_mm ?? 3}mm`)
    // preset tema UI → variabel CSS di <html>
    const theme = resolveTheme(settings.ui_theme, settings.ui_accent)
    root.dataset.theme = theme.id
    const vars = themeVars(theme, !!settings.dark_mode)
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
    // warna bilah browser mengikuti latar tema
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${vars['--canvas']})`)
  }, [settings?.dark_mode, settings?.print_margin_mm, settings?.ui_theme, settings?.ui_accent])
}
