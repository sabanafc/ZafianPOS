import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { Modal } from '../Modal'
import { Button, Input, Field, Spinner, Segmented } from '../ui'
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
          <p className="text-sm text-muted">Cash in/out hanya bisa dicatat saat shift aktif. Buka shift terlebih dulu.</p>
          <Button variant="secondary" className="w-full" onClick={() => { onClose(); }}>
            Mengerti
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Switch in/out */}
          <Segmented
            full value={mode} onChange={onSwitchMode} label="Jenis cash movement"
            options={([['in', 'Masuk'], ['out', 'Keluar']] as Array<['in' | 'out', string]>).map(([m, lbl]) => ({
              value: m, label: lbl,
              icon: m === 'in' ? <ArrowDownToLine size={17} aria-hidden /> : <ArrowUpFromLine size={17} aria-hidden />,
            }))}
          />

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
            <p className="text-center text-sm font-semibold text-muted" aria-live="polite">
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
