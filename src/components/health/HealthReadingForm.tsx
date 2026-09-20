import { useState } from 'react'
import {
  BP_CONTEXTS,
  CUSTOM_FIELD_PRESETS,
  GLUCOSE_CONTEXTS,
  HR_CONTEXTS,
  PERIOD_FLOWS,
  PERIOD_SYMPTOMS,
  TEMP_METHODS,
  createCustomTracker,
} from '../../db/health'
import type { AppSettings, CustomFieldDef, HealthReading, HealthTracker } from '../../types'

export interface ReadingFormValue {
  timestamp: number
  values: Record<string, number | string>
  context?: string
  notes?: string
}

const inputCls = 'w-full rounded-xl border px-3.5 py-2.5 text-base'
const inputStyle = { borderColor: 'var(--mr-border)', background: 'var(--mr-surface)', color: 'var(--mr-text)' }

function dateTimeParts(ts: number): { date: string; time: string } {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` }
}

function combineParts(date: string, time: string, fallback: number): number {
  if (!date) return fallback
  const [y, m, d] = date.split('-').map(Number)
  const [h = 0, min = 0] = (time || '00:00').split(':').map(Number)
  if (!y || !m || !d) return fallback
  return new Date(y, m - 1, d, h || 0, min || 0).getTime()
}

export function HealthReadingForm({
  tracker,
  settings,
  initial,
  pending,
  error,
  onSave,
  onCancel,
}: {
  tracker: HealthTracker
  settings: AppSettings
  initial?: HealthReading | null
  pending: boolean
  error: string | null
  onSave: (v: ReadingFormValue) => void
  onCancel: () => void
}) {
  const now = initial?.timestamp ?? Date.now()
  const parts = dateTimeParts(now)
  const [date, setDate] = useState(parts.date)
  const [time, setTime] = useState(parts.time)
  const [values, setValues] = useState<Record<string, number | string>>(initial?.values ?? defaultsFor(tracker, settings))
  const [context, setContext] = useState(initial?.context ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const set = (k: string, v: number | string) => setValues((cur) => ({ ...cur, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ timestamp: combineParts(date, time, now), values, context: context || undefined, notes: notes || undefined })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">Date
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
        <label className="block">Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} style={inputStyle} />
        </label>
      </div>

      {tracker.key === 'bp' ? (
        <div className="grid grid-cols-3 gap-3">
          <label className="block">Systolic *<input type="number" required value={str(values.systolic)} onChange={(e) => set('systolic', e.target.value)} placeholder="118" className={inputCls} style={inputStyle} /></label>
          <label className="block">Diastolic *<input type="number" required value={str(values.diastolic)} onChange={(e) => set('diastolic', e.target.value)} placeholder="76" className={inputCls} style={inputStyle} /></label>
          <label className="block">Pulse<input type="number" value={str(values.pulse)} onChange={(e) => set('pulse', e.target.value)} placeholder="72" className={inputCls} style={inputStyle} /></label>
        </div>
      ) : null}
      {tracker.key === 'glucose' ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">Glucose *<input type="number" step="any" required value={str(values.value)} onChange={(e) => set('value', e.target.value)} placeholder="108" className={inputCls} style={inputStyle} /></label>
          <label className="block">Unit
            <select value={String(values.unit ?? settings.glucoseUnit)} onChange={(e) => set('unit', e.target.value)} className={inputCls} style={inputStyle}>
              <option value="mg/dL">mg/dL</option>
              <option value="mmol/L">mmol/L</option>
            </select>
          </label>
        </div>
      ) : null}
      {tracker.key === 'weight' ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">Weight *<input type="number" step="any" required value={str(values.value)} onChange={(e) => set('value', e.target.value)} placeholder="64.2" className={inputCls} style={inputStyle} /></label>
          <label className="block">Unit
            <select value={String(values.unit ?? settings.weightUnit)} onChange={(e) => set('unit', e.target.value)} className={inputCls} style={inputStyle}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </label>
        </div>
      ) : null}
      {tracker.key === 'hr' ? (
        <label className="block">Heart rate (bpm) *<input type="number" required value={str(values.value)} onChange={(e) => set('value', e.target.value)} placeholder="72" className={inputCls} style={inputStyle} /></label>
      ) : null}
      {tracker.key === 'spo2' ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">SpO2 (%) *<input type="number" required min={1} max={100} value={str(values.value)} onChange={(e) => set('value', e.target.value)} placeholder="98" className={inputCls} style={inputStyle} /></label>
          <label className="block">Pulse<input type="number" value={str(values.pulse)} onChange={(e) => set('pulse', e.target.value)} placeholder="72" className={inputCls} style={inputStyle} /></label>
        </div>
      ) : null}
      {tracker.key === 'temp' ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">Temperature *<input type="number" step="any" required value={str(values.value)} onChange={(e) => set('value', e.target.value)} placeholder="37" className={inputCls} style={inputStyle} /></label>
          <label className="block">Unit
            <select value={String(values.unit ?? (settings.tempUnit === 'F' ? '°F' : '°C'))} onChange={(e) => set('unit', e.target.value)} className={inputCls} style={inputStyle}>
              <option value="°C">°C</option>
              <option value="°F">°F</option>
            </select>
          </label>
        </div>
      ) : null}
      {tracker.key === 'period' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">Start *<input type="date" required value={String(values.start ?? '')} onChange={(e) => set('start', e.target.value)} className={inputCls} style={inputStyle} /></label>
            <label className="block">End<input type="date" value={String(values.end ?? '')} onChange={(e) => set('end', e.target.value)} className={inputCls} style={inputStyle} /></label>
          </div>
          <label className="block">Flow
            <select value={String(values.flow ?? '')} onChange={(e) => set('flow', e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">—</option>
              {PERIOD_FLOWS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <SymptomToggles selected={String(values.symptoms ?? '').split(',').filter(Boolean)} onChange={(s) => set('symptoms', s.join(','))} />
          <label className="block">Pain (1–10)
            <input type="number" min={1} max={10} value={str(values.pain)} onChange={(e) => set('pain', e.target.value)} className={inputCls} style={inputStyle} />
          </label>
        </div>
      ) : null}
      {tracker.key === 'symptom' ? (
        <div className="space-y-3">
          <label className="block">Symptom *<input required value={String(values.name ?? '')} onChange={(e) => set('name', e.target.value)} placeholder="Headache" className={inputCls} style={inputStyle} autoComplete="off" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">Severity (1–10) *<input type="number" required min={1} max={10} value={str(values.severity)} onChange={(e) => set('severity', e.target.value)} className={inputCls} style={inputStyle} /></label>
            <label className="block">Duration<input value={String(values.duration ?? '')} onChange={(e) => set('duration', e.target.value)} placeholder="2 hours" className={inputCls} style={inputStyle} /></label>
          </div>
          <label className="block">Trigger<input value={String(values.trigger ?? '')} onChange={(e) => set('trigger', e.target.value)} className={inputCls} style={inputStyle} /></label>
        </div>
      ) : null}
      {tracker.key === 'custom' ? (
        <div className="space-y-3">
          {(tracker.fieldsSchema ?? []).map((f) => (
            <label key={f.name} className="block">{f.label}{f.unit ? ` (${f.unit})` : ''}
              {f.kind === 'time' ? (
                <input type="time" value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} className={inputCls} style={inputStyle} />
              ) : f.kind === 'date' ? (
                <input type="date" value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} className={inputCls} style={inputStyle} />
              ) : f.kind === 'severity10' ? (
                <input type="number" min={1} max={10} value={str(values[f.name])} onChange={(e) => set(f.name, e.target.value)} className={inputCls} style={inputStyle} />
              ) : f.kind === 'quality5' ? (
                <input type="number" min={1} max={5} value={str(values[f.name])} onChange={(e) => set(f.name, e.target.value)} className={inputCls} style={inputStyle} />
              ) : f.kind === 'number' ? (
                <input type="number" step="any" value={str(values[f.name])} onChange={(e) => set(f.name, e.target.value)} className={inputCls} style={inputStyle} />
              ) : (
                <input value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} className={inputCls} style={inputStyle} />
              )}
            </label>
          ))}
        </div>
      ) : null}

      {(tracker.key === 'bp' || tracker.key === 'glucose' || tracker.key === 'hr' || tracker.key === 'temp') ? (
        <label className="block">Context
          <select value={context} onChange={(e) => setContext(e.target.value)} className={inputCls} style={inputStyle}>
            <option value="">—</option>
            {(tracker.key === 'bp' ? BP_CONTEXTS : tracker.key === 'glucose' ? GLUCOSE_CONTEXTS : tracker.key === 'hr' ? HR_CONTEXTS : TEMP_METHODS).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      ) : null}

      {tracker.key !== 'period' && tracker.key !== 'symptom' ? (
        <label className="block">Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} style={inputStyle} />
        </label>
      ) : (
        <label className="block">Notes
          <textarea value={String(values.notes ?? notes)} onChange={(e) => { set('notes', e.target.value); setNotes(e.target.value) }} rows={2} className={inputCls} style={inputStyle} />
        </label>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-full border px-4 py-3 font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className="mr-btn-primary flex-1 px-4 py-3 disabled:opacity-60">
          {pending ? 'Saving…' : initial ? 'Save changes' : 'Save reading'}
        </button>
      </div>
    </form>
  )
}

function defaultsFor(tracker: HealthTracker, settings: AppSettings): Record<string, number | string> {
  switch (tracker.key) {
    case 'glucose': return { unit: settings.glucoseUnit }
    case 'weight': return { unit: settings.weightUnit }
    case 'temp': return { unit: settings.tempUnit === 'F' ? '°F' : '°C' }
    default: return {}
  }
}

function str(v: number | string | undefined): string {
  return v == null ? '' : String(v)
}

function SymptomToggles({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  return (
    <div>
      <span className="mr-muted text-sm">Symptoms</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {PERIOD_SYMPTOMS.map((s) => {
          const on = selected.includes(s)
          return (
            <button key={s} type="button" aria-pressed={on} onClick={() => onChange(on ? selected.filter((x) => x !== s) : [...selected, s])}
              className="rounded-full border px-3 py-1.5 text-sm font-medium"
              style={on ? { background: 'var(--mr-primary-deep)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--mr-border)' }}>
              {s}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CustomTrackerForm({ onDone }: { onDone: (t: { id: string }) => void }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [picked, setPicked] = useState<string[]>(['severity', 'duration'])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const fields: CustomFieldDef[] = CUSTOM_FIELD_PRESETS.filter((f) => picked.includes(f.name))
      const t = await createCustomTracker(name, unit || undefined, fields)
      onDone({ id: t.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create tracker.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={save} className="mr-card space-y-3 p-5">
      <h3 className="mr-h2">New custom tracker</h3>
      {error ? <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p> : null}
      <label className="block">Name *
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Migraine, Water intake, Sleep…" className={inputCls} style={inputStyle} autoComplete="off" />
      </label>
      <label className="block">Unit (optional)
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="glasses, hours…" className={inputCls} style={inputStyle} />
      </label>
      <div>
        <span className="mr-muted text-sm">Fields *</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {CUSTOM_FIELD_PRESETS.map((f) => {
            const on = picked.includes(f.name)
            return (
              <button key={f.name} type="button" aria-pressed={on} onClick={() => setPicked(on ? picked.filter((x) => x !== f.name) : [...picked, f.name])}
                className="rounded-full border px-3 py-1.5 text-sm font-medium"
                style={on ? { background: 'var(--mr-primary-deep)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--mr-border)' }}>
                {f.label}
              </button>
            )
          })}
        </div>
      </div>
      <button type="submit" disabled={pending} className="mr-btn-primary w-full px-4 py-3 disabled:opacity-60">
        {pending ? 'Creating…' : 'Create tracker'}
      </button>
    </form>
  )
}
