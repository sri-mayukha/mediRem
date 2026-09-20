import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { formatReadingSummary } from '../db/health'
import { markSkipped, markTaken } from '../db/medications'
import { db } from '../db/database'
import { formatTimeLabel } from '../lib/time'
import type { AppSettings, DoseStatus, HealthReading, HealthTracker, Medication, MedicationDoseEvent, TrackerKey } from '../types'

const STATUS_FILTERS: { id: DoseStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'taken', label: 'Taken' },
  { id: 'skipped', label: 'Skipped' },
  { id: 'missed', label: 'Missed' },
]

type KindFilter = 'all' | 'meds' | TrackerKey

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'meds', label: 'Medications' },
  { id: 'bp', label: 'Blood pressure' },
  { id: 'glucose', label: 'Glucose' },
  { id: 'weight', label: 'Weight' },
  { id: 'period', label: 'Period' },
  { id: 'symptom', label: 'Symptoms' },
]

interface Row {
  at: number
  kind: 'dose' | 'reading'
  dose?: MedicationDoseEvent
  reading?: HealthReading
  tracker?: HealthTracker
}

export function HistoryScreen({ tick, onChanged, settings }: { tick: number; onChanged: () => void; settings: AppSettings }) {
  const [events, setEvents] = useState<MedicationDoseEvent[]>([])
  const [readings, setReadings] = useState<HealthReading[]>([])
  const [medsById, setMedsById] = useState<Map<string, Medication>>(new Map())
  const [trackersById, setTrackersById] = useState<Map<string, HealthTracker>>(new Map())
  const [status, setStatus] = useState<DoseStatus | 'all'>('all')
  const [kind, setKind] = useState<KindFilter>('all')
  const [medFilter, setMedFilter] = useState<string>('all')
  const [range, setRange] = useState<'7' | '30' | 'all'>('30')
  const [limit, setLimit] = useState(100)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [meds, trackers, doses, rdgs] = await Promise.all([
        db.medications.toArray(),
        db.trackers.toArray(),
        db.doseEvents.orderBy('scheduledAt').reverse().limit(500).toArray(),
        db.readings.orderBy('timestamp').reverse().limit(500).toArray(),
      ])
      if (!alive) return
      setMedsById(new Map(meds.map((m) => [m.id, m])))
      setTrackersById(new Map(trackers.map((t) => [t.id, t])))
      setEvents(doses)
      setReadings(rdgs)
    })()
    return () => {
      alive = false
    }
  }, [tick])

  const filtered = useMemo(() => {
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000
    const rows: Row[] = []
    for (const e of events) {
      if (e.scheduledAt < cutoff) continue
      if (e.status === 'upcoming' || e.status === 'due' || e.status === 'snoozed') continue
      if (status !== 'all' && e.status !== status) continue
      if (kind !== 'all' && kind !== 'meds') continue
      if (medFilter !== 'all' && e.medicationId !== medFilter) continue
      rows.push({ at: e.scheduledAt, kind: 'dose', dose: e })
    }
    for (const r of readings) {
      if (r.timestamp < cutoff) continue
      const t = trackersById.get(r.trackerId)
      if (status !== 'all') continue // status filter applies to doses only
      if (kind !== 'all') {
        if (kind === 'meds') continue
        if (!t || t.key !== kind) continue
      }
      if (medFilter !== 'all') continue
      rows.push({ at: r.timestamp, kind: 'reading', reading: r, tracker: t })
    }
    return rows.sort((a, b) => b.at - a.at)
  }, [events, readings, trackersById, status, kind, medFilter, range])

  // Reset pagination when filters change so users always start at the top.
  useEffect(() => {
    setLimit(100)
  }, [status, kind, medFilter, range, tick])

  const visible = filtered.slice(0, limit)

  const correct = async (e: MedicationDoseEvent, to: DoseStatus) => {
    if (to === 'taken') await markTaken(e.id)
    else if (to === 'skipped') await markSkipped(e.id)
    onChanged()
  }

  return (
    <div className="space-y-4">
      <h1 className="mr-h1">History</h1>
      <div className="mr-card space-y-3 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
          {KIND_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={kind === f.id} onClick={() => setKind(f.id)}
              className="rounded-full border px-3.5 py-1.5 text-sm font-semibold"
              style={kind === f.id ? { background: 'var(--mr-primary-deep)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--mr-border)', color: 'var(--mr-muted)' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={status === f.id} onClick={() => setStatus(f.id)}
              className="rounded-full border px-3.5 py-1.5 text-sm font-semibold"
              style={status === f.id ? { background: 'var(--mr-primary-deep)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--mr-border)', color: 'var(--mr-muted)' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        <EmptyState title="No history yet" body="Taken, skipped and missed doses plus health readings will appear here." />
      ) : (
        <>
        <ol className="space-y-2">
          {visible.map((row, i) => {
            if (row.kind === 'dose' && row.dose) {
              const e = row.dose
              const m = medsById.get(e.medicationId)
              const dateStr = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(e.scheduledAt))
              const statusLabel = e.status === 'taken' ? `✓ Taken${e.takenAt ? ` at ${formatTimeLabel(e.takenAt)}` : ''}` : e.status === 'skipped' ? '– Skipped' : e.status === 'missed' ? '○ Missed' : e.status
              return (
                <li key={`d-${e.id}`} className="mr-card flex items-center justify-between gap-3 p-3.5">
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
            }
            const r = row.reading!
            const t = row.tracker
            const dateStr = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(r.timestamp))
            return (
              <li key={`r-${r.id}-${i}`} className="mr-card flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{dateStr} · {t?.name ?? 'Health'}</p>
                  <p className="mr-muted text-sm">{t ? formatReadingSummary(t, r, settings) : ''}</p>
                </div>
              </li>
            )
          })}
        </ol>
        {visible.length < filtered.length ? (
          <button
            type="button"
            onClick={() => setLimit((l) => l + 100)}
            className="mt-3 w-full rounded-full border px-4 py-3 font-semibold"
            style={{ borderColor: 'var(--mr-border)' }}
          >
            Show more ({filtered.length - visible.length} remaining)
          </button>
        ) : null}
        </>
      )}
    </div>
  )
}
