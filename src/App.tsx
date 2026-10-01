import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import PosPage from './pages/PosPage'
import MenuPage from './pages/MenuPage'
import IngredientsPage from './pages/IngredientsPage'
import FinancePage from './pages/FinancePage'
import SettingsPage from './pages/SettingsPage'
import SetupScreen from './pages/SetupScreen'
import { Toasts } from './lib/toast'
import { useSettings, useThemeEffect } from './hooks/useSettings'
import { isConfigured, supabase } from './lib/supabase'
import { Spinner } from './components/ui'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
})

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Memuat aplikasi">
      <Spinner />
    </div>
  )
}

/** Cek koneksi database sekali di awal — tampilkan error yang jelas bila gagal */
function DbGate({ children }: { children: React.ReactNode }) {
  const probe = useQuery({
    queryKey: ['db-probe'],
    queryFn: async () => {
      const { error } = await supabase.from('settings').select('id').limit(1)
      if (error) throw error
      return true
    },
    retry: 1,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  if (probe.isPending) return <Splash />
  if (probe.isError) return <SetupScreen connError={(probe.error as Error).message} />
  return <>{children}</>
}

function Shell() {
  const { settings } = useSettings()
  useThemeEffect(settings)

  if (!isConfigured) return <SetupScreen />

  return (
    <DbGate>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/bahan" element={<IngredientsPage />} />
          <Route path="/keuangan" element={<FinancePage />} />
          <Route path="/pengaturan" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </DbGate>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Shell />
        <Toasts />
      </HashRouter>
    </QueryClientProvider>
  )
}
