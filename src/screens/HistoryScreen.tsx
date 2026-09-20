import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { markSkipped, markTaken } from '../db/medications'
import { db } from '../db/database'
import { formatTimeLabel } from '../lib/time'
import type { DoseStatus, Medication, MedicationDoseEvent } from '../types'

const STATUS_FILTERS: { id: DoseStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'taken', label: 'Taken' },
  { id: 'skipped', label: 'Skipped' },
  { id: 'missed', label: 'Missed' },
]

export function HistoryScreen({ tick, onChanged }: { tick: number; onChanged: () => void }) {
  const [events, setEvents] = useState<MedicationDoseEvent[]>([])
  const [medsById, setMedsById] = useState<Map<string, Medication>>(new Map())
  const [status, setStatus] = useState<DoseStatus | 'all'>('all')
  const [medFilter, setMedFilter] = useState<string>('all')
  const [range, setRange] = useState<'7' | '30' | 'all'>('30')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const meds = await db.medications.toArray()
      if (!alive) return
      setMedsById(new Map(meds.map((m) => [m.id, m])))
      const rows = await db.doseEvents.orderBy('scheduledAt').reverse().limit(300).toArray()
      if (alive) setEvents(rows)
    })()
    return () => {
      alive = false
    }
  }, [tick])

  const filtered = useMemo(() => {
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000
    return events.filter((e) => {
      if (e.scheduledAt < cutoff) return false
      if (status !== 'all' && e.status !== status) return false
      if (medFilter !== 'all' && e.medicationId !== medFilter) return false
      return true
    })
  }, [events, status, medFilter, range])

  const correct = async (e: MedicationDoseEvent, to: DoseStatus) => {
    if (to === 'taken') await markTaken(e.id)
    else if (to === 'skipped') await markSkipped(e.id)
    onChanged()
  }

  return (
    <div className="space-y-4">
      <h1 className="mr-h1">History</h1>
      <div className="mr-card space-y-3 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={status === f.id} onClick={() => setStatus(f.id)}
              className="rounded-full border px-3.5 py-1.5 text-sm font-semibold"
              style={status === f.id ? { background: 'var(--mr-primary-deep)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--mr-border)', color: 'var(--mr-muted)' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <label>Medication
            <select value={medFilter} onChange={(e) => setMedFilter(e.target.value)} className="ml-2 rounded-xl border px-3 py-1.5" style={{ borderColor: 'var(--mr-border)', background: 'var(--mr-surface)' }}>
              <option value="all">All</option>
              {[...medsById.values()].map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <div role="group" aria-label="Date range" className="flex gap-1 rounded-full border p-1" style={{ borderColor: 'var(--mr-border)' }}>
            {(['7', '30', 'all'] as const).map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className="rounded-full px-3 py-1 text-sm font-semibold"
                style={range === r ? { background: 'var(--mr-primary-deep)', color: '#fff' } : { color: 'var(--mr-muted)' }}>
                {r === 'all' ? 'All' : `${r}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No history yet" body="Taken, skipped and missed doses will appear here. Health records arrive in Phase 2." />
      ) : (
        <ol className="space-y-2">
          {filtered.map((e) => {
            const m = medsById.get(e.medicationId)
            const date = new Date(e.scheduledAt)
            const dateStr = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date)
            const statusLabel = e.status === 'taken' ? `✓ Taken${e.takenAt ? ` at ${formatTimeLabel(e.takenAt)}` : ''}` : e.status === 'skipped' ? '– Skipped' : e.status === 'missed' ? '○ Missed' : e.status
            return (
              <li key={e.id} className="mr-card flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{dateStr} · {m?.name ?? 'Removed medication'}</p>
                  <p className="mr-muted text-sm">{statusLabel}{m ? ` · ${m.doseAmount} ${m.doseUnit}` : ''}</p>
                </div>
                {(e.status === 'taken' || e.status === 'skipped') ? (
                  <button
                    type="button"
                    onClick={() => void correct(e, e.status === 'taken' ? 'skipped' : 'taken')}
                    className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: 'var(--mr-border)' }}
                    aria-label={`Correct ${m?.name ?? 'dose'} to ${e.status === 'taken' ? 'skipped' : 'taken'}`}
                  >
                    Correct
                  </button>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
