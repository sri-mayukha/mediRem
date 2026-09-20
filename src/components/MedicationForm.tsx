import { useMemo, useState } from 'react'
import { defaultStartDate, type MedicationInput, type ScheduleInput } from '../db/medications'
import { addDays, parseLocalDateStr, toLocalDateStr } from '../lib/time'
import type { Medication, MedicationForm, MedicationSchedule } from '../types'

const FORMS: MedicationForm[] = ['tablet', 'capsule', 'syrup', 'liquid', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'other']
const FOOD = ['Any time', 'Before food', 'With food', 'After food', 'Empty stomach', 'Before breakfast', 'After breakfast', 'Before lunch', 'After lunch', 'Before dinner', 'After dinner', 'Before bed']
const STRUCTURED = ['Take with food', 'Take without food', 'Take before sleep', 'Take with water']

export interface MedFormValue {
  med: MedicationInput
  sched: ScheduleInput
}

export function emptyFormValue(): MedFormValue {
  return {
    med: {
      name: '', form: 'tablet', doseAmount: 1, doseUnit: 'tablet', qtyPerDose: 1,
      status: 'active', foodInstruction: 'Any time', structuredInstructions: [],
      initialQty: undefined, currentQty: undefined,
    } as MedicationInput,
    sched: { type: 'once_daily', times: ['08:00'], startDate: defaultStartDate() } as ScheduleInput,
  }
}

export function formValueFrom(med: Medication, sched?: MedicationSchedule): MedFormValue {
  return {
    med: { ...med },
    sched: sched ? { ...sched } : { type: 'once_daily', times: ['08:00'], startDate: med.createdAt ? toLocalDateStr(new Date(med.createdAt)) : defaultStartDate() },
  }
}

export function MedicationForm({
  initial,
  pending,
  error,
  onSave,
  onCancel,
}: {
  initial: MedFormValue
  pending: boolean
  error: string | null
  onSave: (v: MedFormValue) => void
  onCancel: () => void
}) {
  const [v, setV] = useState<MedFormValue>(initial)
  const [duration, setDuration] = useState<string>('')
  const [ongoing, setOngoing] = useState(!initial.sched.endDate)

  const setMed = (p: Partial<MedFormValue['med']>) => setV((cur) => ({ ...cur, med: { ...cur.med, ...p } }))
  const setSched = (p: Partial<MedFormValue['sched']>) => setV((cur) => ({ ...cur, sched: { ...cur.sched, ...p } }))

  const endPreview = useMemo(() => {
    const n = Number(duration)
    if (!duration || !(n > 0)) return v.sched.endDate ?? null
    return toLocalDateStr(addDays(parseLocalDateStr(v.sched.startDate), n - 1))
  }, [duration, v.sched.startDate, v.sched.endDate])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const sched = { ...v.sched }
    if (ongoing) delete sched.endDate
    else if (endPreview) sched.endDate = endPreview
    onSave({ med: v.med, sched })
  }

  const inputCls = 'w-full rounded-xl border px-3.5 py-2.5 text-base'
  const inputStyle = { borderColor: 'var(--mr-border)', background: 'var(--mr-surface)', color: 'var(--mr-text)' }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100">{error}</p> : null}

      <section className="mr-card space-y-3 p-5" aria-labelledby="mf-basic">
        <h3 id="mf-basic" className="mr-h2">Medicine</h3>
        <label className="block">Name *
          <input required value={v.med.name} onChange={(e) => setMed({ name: e.target.value })} placeholder="Metformin" className={inputCls} style={inputStyle} autoComplete="off" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">Generic (optional)
            <input value={v.med.genericName ?? ''} onChange={(e) => setMed({ genericName: e.target.value })} className={inputCls} style={inputStyle} autoComplete="off" />
          </label>
          <label className="block">Brand (optional)
            <input value={v.med.brandName ?? ''} onChange={(e) => setMed({ brandName: e.target.value })} className={inputCls} style={inputStyle} autoComplete="off" />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">Strength
            <input value={v.med.strength ?? ''} onChange={(e) => setMed({ strength: e.target.value })} placeholder="500" inputMode="decimal" className={inputCls} style={inputStyle} />
          </label>
          <label className="block">Unit
            <input value={v.med.strengthUnit ?? ''} onChange={(e) => setMed({ strengthUnit: e.target.value })} placeholder="mg" className={inputCls} style={inputStyle} />
          </label>
          <label className="block">Form
            <select value={v.med.form} onChange={(e) => setMed({ form: e.target.value as MedicationForm })} className={inputCls} style={inputStyle}>
              {FORMS.map((f) => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
            </select>
          </label>
        </div>
        {v.med.form === 'other' ? (
          <label className="block">Custom form
            <input value={v.med.customForm ?? ''} onChange={(e) => setMed({ customForm: e.target.value })} className={inputCls} style={inputStyle} />
          </label>
        ) : null}
        <div className="grid grid-cols-3 gap-3">
          <label className="block">Dose *
            <input type="number" min={0.01} step="any" required value={v.med.doseAmount} onChange={(e) => setMed({ doseAmount: Number(e.target.value) })} className={inputCls} style={inputStyle} />
          </label>
          <label className="block">Dose unit
            <input value={v.med.doseUnit} onChange={(e) => setMed({ doseUnit: e.target.value })} placeholder="tablet / ml / drops" className={inputCls} style={inputStyle} />
          </label>
          <label className="block">Qty / dose *
            <input type="number" min={0.01} step="any" required value={v.med.qtyPerDose} onChange={(e) => setMed({ qtyPerDose: Number(e.target.value) })} className={inputCls} style={inputStyle} />
          </label>
        </div>
      </section>

      <section className="mr-card space-y-3 p-5" aria-labelledby="mf-sched">
        <h3 id="mf-sched" className="mr-h2">Schedule</h3>
        <label className="block">Frequency
          <select value={v.sched.type} onChange={(e) => {
            const t = e.target.value as ScheduleInput['type']
            if (t === 'once_daily') setSched({ type: t, times: [v.sched.times[0] ?? '08:00'] })
            else if (t === 'sos') setSched({ type: t, times: [] })
            else if (t === 'interval_hours') setSched({ type: t, intervalHours: v.sched.intervalHours ?? 8, times: [v.sched.times[0] ?? '08:00'] })
            else setSched({ type: t })
          }} className={inputCls} style={inputStyle}>
            <option value="once_daily">Once daily</option>
            <option value="multi_daily">Multiple times per day</option>
            <option value="weekly">Specific days (e.g. Mon/Wed/Fri)</option>
            <option value="interval_hours">Every X hours</option>
            <option value="sos">As needed (SOS)</option>
          </select>
        </label>
        {v.sched.type !== 'sos' && v.sched.type !== 'interval_hours' ? (
          <TimesEditor times={v.sched.times} onChange={(times) => setSched({ times })} />
        ) : null}
        {v.sched.type === 'interval_hours' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">Every (hours) *
              <input type="number" min={1} value={v.sched.intervalHours ?? 8} onChange={(e) => setSched({ intervalHours: Number(e.target.value) })} className={inputCls} style={inputStyle} />
            </label>
            <label className="block">Anchor time
              <input type="time" value={v.sched.times[0] ?? '08:00'} onChange={(e) => setSched({ times: [e.target.value] })} className={inputCls} style={inputStyle} />
            </label>
          </div>
        ) : null}
        {v.sched.type === 'weekly' ? <WeekdayPicker value={v.sched.daysOfWeek ?? []} onChange={(daysOfWeek) => setSched({ daysOfWeek })} /> : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">Start *
            <input type="date" required value={v.sched.startDate} onChange={(e) => setSched({ startDate: e.target.value })} className={inputCls} style={inputStyle} />
          </label>
          <label className="block">Duration (days)
            <input type="number" min={1} value={duration} disabled={ongoing} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 14" className={inputCls} style={inputStyle} />
          </label>
        </div>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} className="h-5 w-5 accent-[#5C7A66]" />
          Ongoing (no end date)
        </label>
        {!ongoing ? (
          <label className="block">End date
            <input type="date" value={endPreview ?? ''} onChange={(e) => { setDuration(''); setSched({ endDate: e.target.value || undefined }) }} className={inputCls} style={inputStyle} />
          </label>
        ) : null}
      </section>

      <section className="mr-card space-y-3 p-5" aria-labelledby="mf-instr">
        <h3 id="mf-instr" className="mr-h2">Instructions</h3>
        <label className="block">Food / timing
          <select value={v.med.foodInstruction ?? 'Any time'} onChange={(e) => setMed({ foodInstruction: e.target.value })} className={inputCls} style={inputStyle}>
            {FOOD.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="mr-muted text-sm">Quick instructions (optional)</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {STRUCTURED.map((s) => {
              const on = (v.med.structuredInstructions ?? []).includes(s)
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => {
                  const cur = v.med.structuredInstructions ?? []
                  setMed({ structuredInstructions: on ? cur.filter((c) => c !== s) : [...cur, s] })
                }} className="rounded-full border px-3 py-1.5 text-sm font-medium" style={on ? { background: 'var(--mr-primary-deep)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--mr-border)' }}>
                  {s}
                </button>
              )
            })}
          </div>
        </fieldset>
        <label className="block"><span className="font-semibold">Doctor's instructions</span>
          <textarea value={v.med.doctorsInstructions ?? ''} onChange={(e) => setMed({ doctorsInstructions: e.target.value })} rows={3} placeholder="Take after dinner with water. Continue for 14 days." className={inputCls} style={inputStyle} />
        </label>
        <label className="block">Additional notes (optional)
          <textarea value={v.med.notes ?? ''} onChange={(e) => setMed({ notes: e.target.value })} rows={2} className={inputCls} style={inputStyle} />
        </label>
      </section>

      <section className="mr-card space-y-3 p-5" aria-labelledby="mf-qty">
        <h3 id="mf-qty" className="mr-h2">Quantity & refill</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">Total quantity
            <input type="number" min={0} step="any" value={v.med.initialQty ?? ''} onChange={(e) => setMed({ initialQty: e.target.value === '' ? undefined : Number(e.target.value), currentQty: v.med.currentQty ?? (e.target.value === '' ? undefined : Number(e.target.value)) })} placeholder="28" className={inputCls} style={inputStyle} />
          </label>
          <label className="block">Current quantity
            <input type="number" min={0} step="any" value={v.med.currentQty ?? ''} onChange={(e) => setMed({ currentQty: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputCls} style={inputStyle} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">Refill when days left ≤
            <input type="number" min={0} value={v.med.refillThresholdDays ?? 7} onChange={(e) => setMed({ refillThresholdDays: Number(e.target.value) })} className={inputCls} style={inputStyle} />
          </label>
          <label className="block">…or doses left ≤
            <input type="number" min={0} value={v.med.refillThresholdDoses ?? ''} onChange={(e) => setMed({ refillThresholdDoses: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputCls} style={inputStyle} />
          </label>
        </div>
      </section>

      <div className="flex gap-2 pb-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-full border px-4 py-3 font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className="mr-btn-primary flex-1 px-4 py-3 disabled:opacity-60">
          {pending ? 'Saving…' : 'Save medication'}
        </button>
      </div>
    </form>
  )
}

function TimesEditor({ times, onChange }: { times: string[]; onChange: (t: string[]) => void }) {
  return (
    <div className="space-y-2">
      <span className="mr-muted text-sm">Times *</span>
      {times.map((t, i) => (
        <div key={i} className="flex gap-2">
          <input type="time" required value={t} onChange={(e) => onChange(times.map((x, j) => (j === i ? e.target.value : x)))} className="flex-1 rounded-xl border px-3.5 py-2.5" style={{ borderColor: 'var(--mr-border)', background: 'var(--mr-surface)' }} />
          {times.length > 1 ? (
            <button type="button" aria-label={`Remove time ${t}`} onClick={() => onChange(times.filter((_, j) => j !== i))} className="rounded-xl border px-3" style={{ borderColor: 'var(--mr-border)' }}>−</button>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...times, '20:00'])} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
        + Add time
      </button>
    </div>
  )
}

function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (d: number[]) => void }) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return (
    <div>
      <span className="mr-muted text-sm">Days *</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {names.map((n, d) => {
          const on = value.includes(d)
          return (
            <button key={n} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
              className="h-11 min-w-11 rounded-full border px-3 font-semibold" style={on ? { background: 'var(--mr-primary-deep)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--mr-border)' }}>
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
