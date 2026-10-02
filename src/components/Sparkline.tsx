/**
 * Grafik mini (sparkline) SVG tanpa library.
 * Dipakai kartu SALDO (halaman Keuangan) dan kartu tren saldo (Dashboard).
 */
export function Sparkline({ points, stroke = 'rgba(255,255,255,0.85)', fillId, className = '' }: {
  points: number[]
  stroke?: string
  fillId?: string // id gradien isian; tanpa ini = tanpa area
  className?: string
}) {
  if (points.length < 2) return null
  const W = 100
  const H = 36
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const step = W / (points.length - 1)
  const xy = points.map((v, i) => [i * step, H - 3 - ((v - min) / span) * (H - 6)] as const)
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lastX, lastY] = xy[xy.length - 1]
  const gradId = fillId || 'spark-plain'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden focusable="false">
      {fillId && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fillId && <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gradId})`} />}
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="2" fill={stroke} />
    </svg>
  )
}
