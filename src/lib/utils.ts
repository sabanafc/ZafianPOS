export const fmtID = (n: number | null | undefined) =>
  'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

export const fmtIDShort = (n: number) => {
  const v = Math.abs(n)
  if (v >= 1_000_000_000) return 'Rp ' + (n / 1_000_000_000).toFixed(1).replace('.', ',') + 'M'
  if (v >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'jt'
  if (v >= 1_000) return 'Rp ' + (n / 1_000).toFixed(0) + 'rb'
  return fmtID(n)
}

export const fmtQty = (n: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(n || 0)

export const todayISO = () => {
  const d = new Date()
  const tz = d.getTimezoneOffset()
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10)
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

export const dayStartISO = (dateStr: string) => dateStr + 'T00:00:00'
export const dayEndISO = (dateStr: string) => dateStr + 'T23:59:59.999'

export const daysAgoISO = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return todayISOFrom(d)
}

const todayISOFrom = (d: Date) => {
  const tz = d.getTimezoneOffset()
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10)
}

export const num = (v: string | number): number => {
  if (typeof v === 'number') return v
  const cleaned = v.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}
