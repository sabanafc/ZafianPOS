import { CHANNELS } from '../../lib/constants'
import type { Channel } from '../../types'

export function ChannelPicker({ value, onChange }: { value: Channel; onChange: (c: Channel) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5" role="radiogroup" aria-label="Tipe pesanan">
      {CHANNELS.map((c) => {
        const active = value === c.id
        return (
          <button
            key={c.id}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c.id)}
            className={`flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${
              active
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
            }`}
          >
            <c.icon size={17} aria-hidden style={active ? undefined : { color: c.color }} />
            {c.short}
          </button>
        )
      })}
    </div>
  )
}
