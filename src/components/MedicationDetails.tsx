import { useEffect, useState } from 'react'
import { correctQuantity, getSchedules, listRefills, recordRefill, scheduleSummary } from '../db/medications'
import { adherence } from '../lib/adherence'
import { courseInfo } from '../lib/course'
import { daysRemaining, dosesRemaining, refillState } from '../lib/inventory'
import { db } from '../db/database'
import type { Medication, MedicationSchedule } from '../types'
import { ConfirmationDialog, useToast } from './Dialogs'

export function MedicationDetails({
  med,
  onEdit,
  onStatus,
  onRemove,
  onClose,
}: {
  med: Medication
  onEdit: () => void
  onStatus: (s: Medication['status']) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [scheds, setScheds] = useState<MedicationSchedule[]>([])
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [refillQty, setRefillQty] = useState('30')
  const [qtyEdit, setQtyEdit] = useState<string>(med.currentQty != null ? String(med.currentQty) : '')
  const [takenCount, setTakenCount] = useState(0)
  const [schedCount, setSchedCount] = useState(0)
  const toast = useToast()

  useEffect(() => {
    let alive = true
    getSchedules(med.id).then((r) => alive && setScheds(r))
    db.doseEvents.where('medicationId').equals(med.id).toArray().then((evts) => {
      if (!alive) return
      const s = adherence(evts)
      setTakenCount(s.recorded)
      setSchedCount(s.scheduled)
    })
    listRefills(med.id).then(() => {
      if (!alive) return
    })
    return () => {
      alive = false
    }
  }, [med.id])

  const sched = scheds[0]
  const course = courseInfo(med, scheds)
  const days = scheds.length > 0 ? daysRemaining(med, scheds) : null
  const doses = dosesRemaining(med)
  const refill = scheds.length > 0 ? refillState(med, scheds) : null
  const strength = [med.strength, med.strengthUnit].filter(Boolean).join(' ')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onClose} className="rounded-full border px-4 py-2 font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
          ← Back
        </button>
        <button type="button" onClick={onEdit} className="rounded-full border px-4 py-2 font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
          Edit medication
        </button>
      </div>

      <section className="mr-card p-5" aria-labelledby="md-title">
        <h2 id="md-title" className="mr-h1">{med.name}</h2>
        <p className="mr-muted mr-body mt-1">
          {[strength, `${med.doseAmount} ${med.doseUnit}`, sched ? scheduleSummary(sched) : null].filter(Boolean).join(' · ')}
        </p>
        {med.foodInstruction && med.foodInstruction !== 'Any time' ? (
          <p className="mt-2 font-semibold">{med.foodInstruction}</p>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="mr-muted">Course</dt><dd className="font-semibold">{sched ? `${sched.startDate}${sched.endDate ? ` → ${sched.endDate}` : ' → ongoing'}` : '—'} · {course.label}</dd></div>
          <div><dt className="mr-muted">Remaining</dt><dd className="font-semibold">{med.currentQty != null ? `${med.currentQty}` : '—'}{doses != null ? ` (${doses} doses)` : ''}</dd></div>
          <div><dt className="mr-muted">Refill</dt><dd className="font-semibold">{refill?.reason ?? (days != null ? `Approximately ${days} days remaining` : '—')}</dd></div>
          <div><dt className="mr-muted">Recorded</dt><dd className="font-semibold">{schedCount === 0 ? 'No scheduled doses yet.' : `${takenCount} / ${schedCount} doses recorded`}</dd></div>
        </dl>
      </section>

      <section className="mr-card p-5" aria-labelledby="md-doc">
        <h3 id="md-doc" className="mr-h2">Doctor's instructions</h3>
        {med.doctorsInstructions ? (
          <blockquote className="mt-2 border-l-4 pl-3" style={{ borderColor: 'var(--mr-primary)' }}>{med.doctorsInstructions}</blockquote>
        ) : (
          <p className="mr-muted mt-2">No doctor's instructions saved.</p>
        )}
        {(med.structuredInstructions ?? []).length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {(med.structuredInstructions ?? []).map((s) => (
              <li key={s} className="rounded-full border px-3 py-1 text-sm" style={{ borderColor: 'var(--mr-border)' }}>{s}</li>
            ))}
          </ul>
        ) : null}
        {med.notes ? (
          <><h4 className="mr-muted mt-4 text-sm font-semibold uppercase tracking-wide">Additional notes</h4><p className="mt-1">{med.notes}</p></>
        ) : null}
      </section>

      <section className="mr-card space-y-3 p-5" aria-labelledby="md-refill">
        <h3 id="md-refill" className="mr-h2">Refill</h3>
        <div className="flex gap-2">
          <label className="flex-1">Add quantity
            <input type="number" min={1} value={refillQty} onChange={(e) => setRefillQty(e.target.value)} className="w-full rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--mr-border)', background: 'var(--mr-surface)' }} />
          </label>
          <button
            type="button"
            className="mr-btn-primary self-end px-5 py-2.5"
            onClick={() => void (async () => {
              try {
                const r = await recordRefill(med.id, Number(refillQty))
                toast.show(`Refilled: ${r.prevQty} → ${r.newQty}`)
              } catch (e) {
                toast.show(e instanceof Error ? e.message : 'Could not record refill.')
              }
            })()}
          >
            Mark as refilled
          </button>
        </div>
        <div className="flex gap-2">
          <label className="flex-1">Correct quantity
            <input type="number" min={0} value={qtyEdit} onChange={(e) => setQtyEdit(e.target.value)} className="w-full rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--mr-border)', background: 'var(--mr-surface)' }} />
          </label>
          <button
            type="button"
            className="self-end rounded-full border px-5 py-2.5 font-semibold"
            style={{ borderColor: 'var(--mr-border)' }}
            onClick={() => void (async () => {
              try {
                await correctQuantity(med.id, Number(qtyEdit))
                toast.show('Quantity updated.')
              } catch (e) {
                toast.show(e instanceof Error ? e.message : 'Invalid quantity.')
              }
            })()}
          >
            Save
          </button>
        </div>
      </section>

      <section className="mr-card flex flex-wrap gap-2 p-5" aria-label="Medication actions">
        {med.status === 'active' ? <ActionBtn label="Pause" onClick={() => onStatus('paused')} /> : null}
        {med.status === 'paused' ? <ActionBtn label="Resume" onClick={() => onStatus('active')} /> : null}
        {med.status !== 'completed' ? <ActionBtn label="Mark completed" onClick={() => onStatus('completed')} /> : null}
        {med.status !== 'archived' ? <ActionBtn label="Archive" onClick={() => onStatus('archived')} /> : <ActionBtn label="Unarchive" onClick={() => onStatus('active')} />}
        <button type="button" onClick={() => setConfirmRemove(true)} className="rounded-full border border-red-300 px-4 py-2.5 font-semibold text-red-800 dark:text-red-200">
          Remove
        </button>
      </section>

      {confirmRemove ? (
        <ConfirmationDialog
          title={`Remove ${med.name}?`}
          body="This will remove it from your medication list. Previous medication history will remain available."
          confirmLabel="Remove"
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false)
            onRemove()
          }}
        />
      ) : null}
      {toast.node}
    </div>
  )
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border px-4 py-2.5 font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
      {label}
    </button>
  )
}
