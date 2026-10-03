import { ShoppingCart, Database, FileCode, Rocket, AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '../components/ui'

export default function SetupScreen({ connError }: { connError?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-ink text-canvas" aria-hidden>
          <ShoppingCart size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Kasir POS</h1>
          <p className="mt-1 text-sm text-muted">Aplikasi kasir modern untuk tablet & ponsel Android</p>
        </div>

        {connError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left dark:border-red-900/50 dark:bg-red-900/20" role="alert">
            <p className="flex items-center gap-2 text-sm font-bold text-red-800 dark:text-red-300">
              <AlertTriangle size={16} aria-hidden /> Koneksi ke database gagal
            </p>
            <p className="mt-1 break-words text-xs text-red-700 dark:text-red-300/80">{connError}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-red-700 dark:text-red-300/80">
              <li>Pastikan <strong>URL</strong> & <strong>anon key</strong> di file <code>.env</code> benar dan tanpa spasi</li>
              <li>Restart dev server setelah mengubah <code>.env</code> (Ctrl+C lalu <code>npm run dev</code>)</li>
              <li>Pastikan proyek Supabase aktif (bukan pause) dan koneksi internet tersedia</li>
              <li>Pastikan migration <code>0001_init.sql</code> sudah dijalankan di SQL Editor</li>
            </ul>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => location.reload()}>
              <RotateCw size={14} aria-hidden /> Coba lagi
            </Button>
          </div>
        )}

        <div className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-left shadow-card">
          <p className="flex items-center gap-2 text-sm font-bold"><Database size={16} aria-hidden /> Setup database</p>
          <ol className="list-decimal space-y-2.5 pl-5 text-sm text-muted">
            <li>
              Buat proyek di <a href="https://supabase.com" target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline dark:text-brand-400">supabase.com</a>.
            </li>
            <li>
              Jalankan isi file <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">supabase/migrations/0001_init.sql</code> di <strong>SQL Editor</strong> Supabase.
            </li>
            <li>
              Salin <strong>Project URL</strong> & <strong>anon key</strong> ke file <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">.env</code> (contoh ada di <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">.env.example</code>).
            </li>
            <li>Restart aplikasi (<code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">npm run dev</code>).</li>
          </ol>
          <p className="flex items-center gap-2 pt-2 text-xs text-muted">
            <FileCode size={14} aria-hidden /> Panduan lengkap tersedia di README.md
          </p>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
          <Rocket size={13} aria-hidden /> Setelah terhubung, buka shift dan mulai berjualan
        </p>
      </div>
    </div>
  )
}
