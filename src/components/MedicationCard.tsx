import { useEffect, useState } from 'react'
import { getSchedules, scheduleSummary } from '../db/medications'
import { daysRemaining, refillState } from '../lib/inventory'
import type { Medication, MedicationSchedule } from '../types'

export function MedicationCard({
  med,
  onOpen,
}: {
  med: Medication
  onOpen: () => void
}) {
  const [sched, setSched] = useState<MedicationSchedule | null>(null)
  useEffect(() => {
    let alive = true
    getSchedules(med.id).then((rows) => {
      if (alive) setSched(rows[0] ?? null)
    })
    return () => {
      alive = false
    }
  }, [med.id])

  const days = sched ? daysRemaining(med, [sched]) : null
  const refill = sched ? refillState(med, [sched]) : null
  const strength = [med.strength, med.strengthUnit].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mr-card w-full p-4 text-left"
      aria-label={`Open ${med.name} details`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-bold leading-tight">{med.name}</p>
          <p className="mr-muted text-sm mt-0.5">
            {[strength, `${med.doseAmount} ${med.doseUnit}`, sched ? scheduleSummary(sched) : null].filter(Boolean).join(' · ')}
          </p>
          {med.foodInstruction && med.foodInstruction !== 'Any time' ? (
            <p className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'color-mix(in srgb, var(--mr-primary) 15%, white)' }}>
              {med.foodInstruction}
            </p>
          ) : null}
        </div>
        <StatusPill status={med.status} />
      </div>
      <div className="mr-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {med.currentQty != null ? <span>{med.currentQty} left</span> : null}
        {days != null ? <span>{days} days remaining</span> : null}
        {refill?.due ? <span className="font-semibold" style={{ color: 'var(--color-amber-soft)' }}>⚠ Refill soon</span> : null}
      </div>
    </button>
  )
}

export function StatusPill({ status }: { status: Medication['status'] }) {
  const label = status[0].toUpperCase() + status.slice(1)
  return (
    <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: 'var(--mr-border)', color: 'var(--mr-muted)' }}>
      {label}
    </span>
  )
}
