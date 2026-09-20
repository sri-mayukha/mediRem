import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../components/Dialogs'
import { EmptyState } from '../components/EmptyState'
import { MiniChart, pickers, toLinePoints } from '../components/health/Chart'
import { CustomTrackerForm, HealthReadingForm, type ReadingFormValue } from '../components/health/HealthReadingForm'
import { PeriodCalendar } from '../components/health/PeriodCalendar'
import {
  addReading,
  cycleDay,
  deleteCustomTracker,
  deleteReading,
  formatReadingSummary,
  fromKg,
  latestReading,
  listTrackers,
  readingsInRange,
  relativeDay,
  setTrackerActive,
  updateReading,
} from '../db/health'
import type { AppSettings, HealthReading, HealthTracker, TrackerKey } from '../types'

const RANGES = [
  { id: 7, label: '7d' },
  { id: 30, label: '30d' },
  { id: 90, label: '3m' },
  { id: 180, label: '6m' },
  { id: 365, label: '1y' },
  { id: 0, label: 'All' },
] as const

export interface HealthAddSignal {
  key: TrackerKey | null
  n: number
}

export function HealthScreen({
  settings,
  tick,
  onChanged,
  addSignal,
  onClearAddSignal,
}: {
  settings: AppSettings
  tick: number
  onChanged: () => void
  addSignal: HealthAddSignal
  onClearAddSignal: () => void
}) {
  const [trackers, setTrackers] = useState<HealthTracker[]>([])
  const [latest, setLatest] = useState<Map<string, HealthReading>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingFor, setAddingFor] = useState<HealthTracker | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const toast = useToast()

  const load = async () => {
    const ts = await listTrackers()
    setTrackers(ts)
    const m = new Map<string, HealthReading>()
    for (const t of ts) {
      const l = await latestReading(t.id)
      if (l) m.set(t.id, l)
    }
    setLatest(m)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  // QuickAdd deep-link: open the form for a tracker
  useEffect(() => {
    if (addSignal.n === 0) return
    if (addSignal.key) {
      listTrackers().then((ts) => {
        const hit = ts.find((t) => t.key === addSignal.key && t.active) ?? ts.find((t) => t.key === addSignal.key)
        if (hit) {
          setSelectedId(hit.id)
          setAddingFor(hit)
        }
        onClearAddSignal()
      })
    } else {
      onClearAddSignal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal.n])

  const selected = trackers.find((t) => t.id === selectedId) ?? null

  if (addingFor) {
    return (
      <AddWrapper
        tracker={addingFor}
        settings={settings}
        onDone={() => {
          setAddingFor(null)
          toast.show('Reading saved.')
          onChanged()
          void load()
        }}
        onCancel={() => setAddingFor(null)}
      />
    )
  }

  if (selected) {
    return (
      <TrackerDetail
        tracker={selected}
        settings={settings}
        tick={tick}
        onChanged={() => {
          onChanged()
          void load()
        }}
        onBack={() => setSelectedId(null)}
        onAdd={() => setAddingFor(selected)}
      />
    )
  }

  const active = trackers.filter((t) => t.active)
  const inactive = trackers.filter((t) => !t.active)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="mr-h1">Health</h1>
        <button type="button" onClick={() => setShowBuilder((s) => !s)} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
          + Custom tracker
        </button>
      </div>
      {showBuilder ? (
        <CustomTrackerForm
          onDone={() => {
            setShowBuilder(false)
            toast.show('Tracker created.')
            onChanged()
            void load()
          }}
        />
      ) : null}
      {active.length === 0 ? (
        <EmptyState title="Nothing recorded yet" body="Start by recording a health measurement." />
      ) : (
        <ul className="space-y-3">
          {active.map((t) => {
            const l = latest.get(t.id)
            return (
              <li key={t.id}>
                <button type="button" onClick={() => setSelectedId(t.id)} className="mr-card w-full p-4 text-left" aria-label={`Open ${t.name}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-bold">{t.name}</p>
                    {t.key === 'period' ? <CycleBadge trackerId={t.id} tick={tick} /> : null}
                  </div>
                  {l ? (
                    <>
                      <p className="mt-0.5 text-[17px] font-semibold">{formatReadingSummary(t, l, settings)}</p>
                      <p className="mr-muted text-sm">Last recorded {relativeDay(l.timestamp)}</p>
                    </>
                  ) : (
                    <p className="mr-muted mt-0.5 text-sm">Nothing recorded yet — tap to add.</p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {inactive.length > 0 ? (
        <details className="mr-card p-4">
          <summary className="cursor-pointer font-semibold">Hidden trackers ({inactive.length})</summary>
          <ul className="mt-2 space-y-1">
            {inactive.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{t.name}</span>
                <button type="button" onClick={() => void setTrackerActive(t.id, true).then(() => { onChanged(); void load() })} className="rounded-full border px-3 py-1" style={{ borderColor: 'var(--mr-border)' }}>
                  Show
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {toast.node}
    </div>
  )
}

function CycleBadge({ trackerId, tick }: { trackerId: string; tick: number }) {
  const [day, setDay] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    readingsInRange(trackerId, 0, Date.now() + 86400000).then((rows) => {
      if (alive) setDay(cycleDay(rows))
    })
    return () => {
      alive = false
    }
  }, [trackerId, tick])
  if (day == null) return null
  return <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold" style={{ borderColor: 'var(--mr-border)' }}>Cycle day {day}</span>
}

function AddWrapper({ tracker, settings, onDone, onCancel }: { tracker: HealthTracker; settings: AppSettings; onDone: () => void; onCancel: () => void }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (v: ReadingFormValue) => {
    setPending(true)
    setError(null)
    try {
      await addReading({ trackerId: tracker.id, ...v })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn\'t save this entry. Your existing data is safe. Please try again.')
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="mr-h1">{tracker.name}</h1>
      <div className="mr-card p-5">
        <HealthReadingForm tracker={tracker} settings={settings} pending={pending} error={error} onSave={save} onCancel={onCancel} />
      </div>
    </div>
  )
}

function TrackerDetail({
  tracker,
  settings,
  tick,
  onChanged,
  onBack,
  onAdd,
}: {
  tracker: HealthTracker
  settings: AppSettings
  tick: number
  onChanged: () => void
  onBack: () => void
  onAdd: () => void
}) {
  const [range, setRange] = useState<number>(30)
  const [rows, setRows] = useState<HealthReading[]>([])
  const [editing, setEditing] = useState<HealthReading | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const toast = useToast()

  const load = async () => {
    const from = range === 0 ? 0 : Date.now() - range * 86400000
    setRows(await readingsInRange(tracker.id, from, Date.now() + 60000))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracker.id, range, tick])

  const latest = rows.length > 0 ? rows[rows.length - 1] : null

  const chart = useMemo(() => {
    if (tracker.key === 'bp') {
      return (
        <MiniChart
          label={`${tracker.name} chart, recorded readings only`}
          unit="mmHg"
          series={[
            { name: 'Systolic', color: '#5C7A66', points: toLinePoints(rows, pickers.bpSys) },
            { name: 'Diastolic', color: '#9B98BC', points: toLinePoints(rows, pickers.bpDia) },
          ]}
        />
      )
    }
    if (['glucose', 'weight', 'hr', 'spo2', 'temp'].includes(tracker.key)) {
      const unit = tracker.key === 'glucose' ? String(latest?.values.unit ?? settings.glucoseUnit)
        : tracker.key === 'weight' ? String(latest?.values.unit ?? settings.weightUnit)
        : tracker.key === 'hr' ? 'bpm'
        : tracker.key === 'spo2' ? '%'
        : String(latest?.values.unit ?? (settings.tempUnit === 'F' ? '°F' : '°C'))
      return <MiniChart label={`${tracker.name} chart`} unit={unit} series={[{ name: tracker.name, color: '#5C7A66', points: toLinePoints(rows, pickers.value) }]} />
    }
    if (tracker.key === 'symptom') {
      return <MiniChart label="Symptom severity" unit="/10" series={[{ name: 'Severity', color: '#5C7A66', points: toLinePoints(rows, pickers.severity) }]} />
    }
    if (tracker.key === 'custom') {
      const schema = tracker.fieldsSchema ?? []
      const numericField = schema.find((f) => ['number', 'severity10', 'quality5'].includes(f.kind))
      if (!numericField) return null
      const pick = (r: HealthReading) => {
        const v = Number(r.values[numericField.name])
        return Number.isFinite(v) ? v : null
      }
      return <MiniChart label={`${tracker.name} chart`} unit={numericField.unit} series={[{ name: numericField.label, color: '#5C7A66', points: toLinePoints(rows, pick) }]} />
    }
    return null
  }, [rows, tracker, latest, settings])

  const weightDelta = useMemo(() => {
    if (tracker.key !== 'weight' || rows.length < 2) return null
    const unit = String(latest?.values.unit ?? settings.weightUnit)
    const toUnit = (r: HealthReading) => {
      const v = Number(r.values.value)
      const u = String(r.values.unit ?? settings.weightUnit)
      return u === unit ? v : unit === 'kg' ? v * 0.45359237 : v / 0.45359237
    }
    const first = toUnit(rows[0])
    const last = toUnit(rows[rows.length - 1])
    const diff = last - first
    const sign = diff > 0 ? '+' : ''
    return `${sign}${diff.toFixed(1)} ${unit} since ${relativeDay(rows[0].timestamp)}`
  }, [rows, tracker.key, latest, settings])

  const saveEdit = async (v: ReadingFormValue) => {
    if (!editing) return
    setPending(true)
    setError(null)
    try {
      await updateReading(editing.id, v)
      setEditing(null)
      toast.show('Reading updated.')
      onChanged()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn\'t save this entry.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="rounded-full border px-4 py-2 font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
          ← Back
        </button>
        <div className="flex gap-2">
          {tracker.key === 'custom' ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete custom tracker "${tracker.name}" and all its readings?`)) {
                  void deleteCustomTracker(tracker.id).then(() => {
                    toast.show('Tracker deleted.')
                    onBack()
                    onChanged()
                  })
                }
              }}
              className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 dark:text-red-200"
            >
              Delete
            </button>
          ) : (
            <HideToggle tracker={tracker} onChanged={onChanged} />
          )}
          <button type="button" onClick={onAdd} className="mr-btn-primary px-5 py-2">
            + Add
          </button>
        </div>
      </div>

      <h1 className="mr-h1">{tracker.name}</h1>

      {latest ? (
        <section className="mr-card p-5" aria-label="Latest reading">
          <p className="mr-muted text-sm">Latest · {relativeDay(latest.timestamp)}</p>
          <p className="mt-0.5 text-xl font-bold">{formatReadingSummary(tracker, latest, settings)}</p>
          {latest.context ? <p className="mr-muted text-sm">{latest.context}</p> : null}
          {latest.notes || latest.values.notes ? <p className="mt-1 text-sm">{String(latest.notes ?? latest.values.notes)}</p> : null}
          {weightDelta ? <p className="mr-muted mt-1 text-sm">{weightDelta}</p> : null}
          {tracker.key === 'period' ? <PeriodMeta rows={rows} /> : null}
        </section>
      ) : (
        <section className="mr-card p-5">
          <p className="mr-muted">Nothing recorded yet for this range. Tap + Add.</p>
        </section>
      )}

      {tracker.key === 'period' ? (
        <section className="mr-card p-5" aria-label="Period calendar">
          <PeriodCalendar readings={rows} />
        </section>
      ) : chart ? (
        <section className="mr-card p-5" aria-label="Chart">
          {chart}
        </section>
      ) : null}

      <div role="group" aria-label="Date range" className="flex flex-wrap gap-1">
        {RANGES.map((r) => (
          <button key={r.label} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}
            className="rounded-full border px-3 py-1.5 text-sm font-semibold"
            style={range === r.id ? { background: 'var(--mr-primary-deep)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--mr-border)', color: 'var(--mr-muted)' }}>
            {r.label}
          </button>
        ))}
      </div>

      {editing ? (
        <section className="mr-card p-5" aria-label="Edit reading">
          <h2 className="mr-h2">Edit reading</h2>
          <div className="mt-3">
            <HealthReadingForm tracker={tracker} settings={settings} initial={editing} pending={pending} error={error} onSave={saveEdit} onCancel={() => setEditing(null)} />
          </div>
        </section>
      ) : null}

      <section aria-label="History">
        <h2 className="mr-h2">History</h2>
        {rows.length === 0 ? (
          <p className="mr-muted mt-2">No readings in this range.</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {[...rows].reverse().map((r) => (
              <li key={r.id} className="mr-card flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{formatReadingSummary(tracker, r, settings)}</p>
                  <p className="mr-muted text-sm">
                    {new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(r.timestamp))}
                    {r.context ? ` · ${r.context}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" onClick={() => setEditing(r)} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
                    Edit
                  </button>
                  {confirmDelete === r.id ? (
                    <>
                      <button type="button" onClick={() => void deleteReading(r.id).then(() => { setConfirmDelete(null); onChanged(); void load() })} className="rounded-full bg-red-800 px-3 py-1.5 text-xs font-semibold text-white">
                        Confirm
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--mr-border)' }}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(r.id)} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      {toast.node}
    </div>
  )
}

function HideToggle({ tracker, onChanged }: { tracker: HealthTracker; onChanged: () => void }) {
  return (
    <button
      type="button"
      onClick={() => void setTrackerActive(tracker.id, false).then(() => onChanged())}
      className="rounded-full border px-4 py-2 text-sm font-semibold"
      style={{ borderColor: 'var(--mr-border)' }}
    >
      Hide
    </button>
  )
}

function PeriodMeta({ rows }: { rows: HealthReading[] }) {
  const day = cycleDay(rows)
  if (day == null) return null
  return <p className="mt-1 text-sm font-semibold">Cycle day {day} · recorded history only, no predictions.</p>
}

export { fromKg }
