import type { IngredientPlan, Projection } from './purchasing'
import { fmtID, fmtQty } from './utils'

/** Ringkasan harian (proyeksi + daftar belanja) sebagai dokumen HTML mandiri. */
export interface DailyReportInput {
  businessName: string
  /** tanggal laporan, sudah diformat (mis. "3 Okt 2026") */
  dateLabel: string
  projection: Projection
  /** bahan yang perlu dibeli untuk horizon ini */
  shopping: IngredientPlan[]
  horizon: number
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

/** Label jumlah beli: kemasan bila diketahui, jika tidak satuan resep. */
export function shoppingQtyLabel(plan: IngredientPlan): string {
  if (plan.packs !== null && plan.pack.hasPack && plan.pack.convertible) {
    return `${fmtQty(plan.packs)} ${plan.pack.packUnit}`
  }
  return `${fmtQty(plan.buyQty)} ${plan.ingredient.unit}`
}

export function buildDailyReportHtml(input: DailyReportInput): string {
  const { businessName, dateLabel, projection, shopping, horizon } = input
  const shoppingCost = shopping.reduce((s, p) => s + p.estCost, 0)
  const marginPct = projection.targetRevenue > 0
    ? Math.round((projection.targetProfit / projection.targetRevenue) * 100)
    : 0

  const menuRows = projection.menus.map((m) => `
      <tr>
        <td>${esc(m.product.name)}</td>
        <td class="num">${fmtQty(m.target)}</td>
        <td class="num">${fmtID(m.product.price)}</td>
        <td class="num">${fmtID(m.hpp)}</td>
        <td class="num">${fmtID(m.targetRevenue)}</td>
        <td class="num">${fmtID(m.targetProfit)}</td>
        <td class="num">${Math.round(m.marginPct)}%</td>
      </tr>`).join('')

  const shoppingRows = shopping.map((p) => `
      <tr>
        <td>${esc(p.ingredient.name)}</td>
        <td class="num">${esc(shoppingQtyLabel(p))}</td>
        <td class="num">${fmtID(p.estCost)}</td>
      </tr>`).join('')

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ringkasan Harian — ${esc(businessName)}</title>
<style>
  :root { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--ink); margin: 0; padding: 24px; background: #fff; }
  .wrap { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0; }
  .sub { color: var(--muted); font-size: 13px; margin: 2px 0 16px; }
  h2 { font-size: 13px; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 700; border-top: 2px solid var(--ink); border-bottom: none; }
  .totals { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
  .box { flex: 1 1 150px; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
  .box span { font-size: 12px; color: var(--muted); }
  .box b { display: block; font-size: 17px; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .actions { margin-bottom: 14px; }
  .actions button { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--line); background: #0f172a; color: #fff; font-weight: 600; cursor: pointer; }
  footer { margin-top: 24px; color: var(--muted); font-size: 12px; line-height: 1.5; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="actions"><button onclick="window.print()">Cetak / Simpan PDF</button></div>
    <h1>${esc(businessName)}</h1>
    <p class="sub">Ringkasan Harian · ${esc(dateLabel)}</p>

    <div class="totals">
      <div class="box"><span>Proyeksi omzet/hari</span><b>${fmtID(projection.targetRevenue)}</b></div>
      <div class="box"><span>HPP bahan/hari</span><b>${fmtID(projection.targetCost)}</b></div>
      <div class="box"><span>Laba kotor/hari</span><b>${fmtID(projection.targetProfit)}</b></div>
      <div class="box"><span>Margin</span><b>${marginPct}%</b></div>
    </div>

    <h2>Proyeksi omzet &amp; laba per menu</h2>
    ${projection.menus.length === 0 ? '<p class="sub">Belum ada menu ber-target.</p>' : `
    <table>
      <thead><tr>
        <th>Menu</th><th class="num">Target</th><th class="num">Harga</th><th class="num">HPP</th>
        <th class="num">Omzet</th><th class="num">Laba</th><th class="num">Margin</th>
      </tr></thead>
      <tbody>${menuRows}</tbody>
      <tfoot><tr>
        <td>Total</td><td class="num">${fmtQty(projection.menus.reduce((s, m) => s + m.target, 0))}</td><td></td><td></td>
        <td class="num">${fmtID(projection.targetRevenue)}</td>
        <td class="num">${fmtID(projection.targetProfit)}</td>
        <td class="num">${marginPct}%</td>
      </tr></tfoot>
    </table>`}

    <h2>Daftar belanja bahan (${horizon} hari)</h2>
    ${shopping.length === 0 ? '<p class="sub">Tidak ada bahan yang perlu dibeli.</p>' : `
    <table>
      <thead><tr><th>Bahan</th><th class="num">Jumlah</th><th class="num">Estimasi</th></tr></thead>
      <tbody>${shoppingRows}</tbody>
      <tfoot><tr><td>Total</td><td></td><td class="num">${fmtID(shoppingCost)}</td></tr></tfoot>
    </table>`}

    <footer>
      Dibuat ${esc(new Date().toLocaleString('id-ID'))}. Laba kotor dihitung dari target × (harga − HPP), belum termasuk beban operasional.<br>
      Rekomendasi bahan memakai data target menu, penjualan, atau asumsi bahan.
    </footer>
  </div>
</body>
</html>`
}

/** Buka ringkasan harian di tab baru (siap cetak/dibagikan). False bila popup diblokir. */
export function openDailyReport(input: DailyReportInput): boolean {
  const html = buildDailyReportHtml(input)
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const win = window.open(url, '_blank')
  if (!win) {
    URL.revokeObjectURL(url)
    return false
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}
