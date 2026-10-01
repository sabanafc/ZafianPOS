import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { Modal } from '../Modal'
import { Button, Input, Field, Spinner } from '../ui'
import { useActiveShift, useAddCashMovement } from '../../hooks/useOrders'
import { fmtID } from '../../lib/utils'
import { toast } from '../../lib/toast'

export function CashSheet({ open, mode, onClose, onSwitchMode }: {
  open: boolean; mode: 'in' | 'out'; onClose: () => void; onSwitchMode: (m: 'in' | 'out') => void
}) {
  const { data: shift } = useActiveShift()
  const addCash = useAddCashMovement()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const submit = () => {
    if (!shift) { toast.error('Buka shift dulu'); return }
    const v = Number(amount) || 0
    if (v <= 0) { toast.error('Nominal harus lebih dari 0'); return }
    addCash.mutate(
      { shift_id: shift.id, type: mode, amount: v, note: note || null },
      { onSuccess: () => { toast.success(`${mode === 'in' ? 'Cash masuk' : 'Cash keluar'} dicatat`); setAmount(''); setNote(''); onClose() }, onError: (e: Error) => toast.error(e.message) },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'in' ? 'Cash In' : 'Cash Out'} size="sm">
      {!shift ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Cash in/out hanya bisa dicatat saat shift aktif. Buka shift terlebih dulu.</p>
          <Button variant="secondary" className="w-full" onClick={() => { onClose(); }}>
            Mengerti
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Switch in/out */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800" role="tablist" aria-label="Jenis cash movement">
            {(['in', 'out'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => onSwitchMode(m)}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ${
                  mode === m ? 'bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {m === 'in' ? <ArrowDownToLine size={17} aria-hidden /> : <ArrowUpFromLine size={17} aria-hidden />}
                {m === 'in' ? 'Masuk' : 'Keluar'}
              </button>
            ))}
          </div>

          <Field label="Nominal" required>
            <Input
              inputMode="numeric" pattern="[0-9]*" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0" className="h-14 text-2xl font-bold tabular-nums"
            />
          </Field>

          <Field label="Keterangan (opsional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. setor ke bank, beli es" />
          </Field>

          {amount !== '' && Number(amount) > 0 && (
            <p className="text-center text-sm font-semibold text-slate-600 dark:text-slate-300" aria-live="polite">
              {mode === 'in' ? 'Menambah' : 'Mengurangi'} kas drawer: <span className={mode === 'in' ? 'text-green-700 dark:text-green-400' : 'text-red-600'}>{fmtID(Number(amount))}</span>
            </p>
          )}

          <Button size="lg" className="w-full" variant={mode === 'in' ? 'primary' : 'danger'} onClick={submit} disabled={addCash.isPending}>
            {addCash.isPending ? <Spinner className="text-white" /> : mode === 'in' ? <ArrowDownToLine size={18} aria-hidden /> : <ArrowUpFromLine size={18} aria-hidden />}
            {mode === 'in' ? 'Catat Cash Masuk' : 'Catat Cash Keluar'}
          </Button>
        </div>
      )}
    </Modal>
  )
}
