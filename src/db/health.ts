import { useCallback, useEffect, useState } from 'react'
import type { AppSettings, CustomFieldDef, HealthReading, HealthTracker, TrackerKey } from '../types'
import { newId } from '../lib/ids'
import { db } from './database'

export const TRACKER_META: Record<Exclude<TrackerKey, 'custom'>, { name: string; unit?: string; blurb: string }> = {
  bp: { name: 'Blood Pressure', unit: 'mmHg', blurb: 'Systolic / diastolic + pulse' },
  glucose: { name: 'Blood Glucose', unit: 'mg/dL', blurb: 'With meal context' },
  weight: { name: 'Weight', unit: 'kg', blurb: 'Trend over time' },
  hr: { name: 'Heart Rate', unit: 'bpm', blurb: 'With context' },
  spo2: { name: 'SpO2', unit: '%', blurb: 'Oxygen saturation + pulse' },
  temp: { name: 'Temperature', unit: '°C', blurb: 'With method' },
  period: { name: 'Period', blurb: 'Cycle calendar, no predictions' },
  symptom: { name: 'Symptoms', blurb: 'Severity 1–10' },
}

export const BP_CONTEXTS = ['Morning', 'Evening', 'Before medication', 'After medication', 'Before exercise', 'After exercise', 'Other']
export const GLUCOSE_CONTEXTS = ['Fasting', 'Before breakfast', 'After breakfast', 'Before lunch', 'After lunch', 'Before dinner', 'After dinner', 'Bedtime', 'Other']
export const HR_CONTEXTS = ['Resting', 'After exercise', 'Morning', 'Evening', 'Other']
export const TEMP_METHODS = ['Oral', 'Forehead', 'Ear', 'Armpit', 'Other']
export const PERIOD_FLOWS = ['Light', 'Medium', 'Heavy']
export const PERIOD_SYMPTOMS = ['Cramps', 'Headache', 'Fatigue', 'Mood changes', 'Bloating', 'Other']

export const CUSTOM_FIELD_PRESETS: CustomFieldDef[] = [
  { name: 'severity', label: 'Severity (1–10)', kind: 'severity10' },
  { name: 'duration', label: 'Duration', kind: 'text' },
  { name: 'trigger', label: 'Trigger', kind: 'text' },
  { name: 'amount', label: 'Amount', kind: 'number' },
  { name: 'quality', label: 'Quality (1–5)', kind: 'quality5' },
  { name: 'bedtime', label: 'Bedtime', kind: 'time' },
  { name: 'waketime', label: 'Wake time', kind: 'time' },
  { name: 'notes', label: 'Notes', kind: 'text' },
]

/** Seed the 8 built-in trackers once (stable ids). */
export async function ensureDefaultTrackers(): Promise<void> {
  const existing = await db.trackers.toArray()
  const have = new Set(existing.map((t) => t.key + '|' + t.id))
  const now = Date.now()
  const seeds: HealthTracker[] = (Object.keys(TRACKER_META) as Exclude<TrackerKey, 'custom'>[]).map((key) => ({
    id: `tracker_${key}`,
    key,
    name: TRACKER_META[key].name,
    unit: TRACKER_META[key].unit,
    active: true,
    createdAt: now,
  }))
  for (const s of seeds) {
    if (!have.has(s.key + '|' + s.id)) {
      const byId = await db.trackers.get(s.id)
      if (!byId) await db.trackers.add(s)
    }
  }
}

export async function listTrackers(): Promise<HealthTracker[]> {
  await ensureDefaultTrackers()
  const all = await db.trackers.toArray()
  const order: TrackerKey[] = ['bp', 'glucose', 'weight', 'hr', 'spo2', 'temp', 'period', 'symptom', 'custom']
  return all.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key) || a.name.localeCompare(b.name))
}

export async function createCustomTracker(name: string, unit: string | undefined, fields: CustomFieldDef[]): Promise<HealthTracker> {
  const clean = name.trim()
  if (!clean) throw new Error('Tracker name is required.')
  if (fields.length === 0) throw new Error('Choose at least one field.')
  const t: HealthTracker = { id: newId('trk'), key: 'custom', name: clean, unit: unit?.trim() || undefined, fieldsSchema: fields, active: true, createdAt: Date.now() }
  await db.trackers.add(t)
  return t
}

export async function setTrackerActive(id: string, active: boolean): Promise<void> {
  const t = await db.trackers.get(id)
  if (!t) return
  await db.trackers.put({ ...t, active })
}

export async function deleteCustomTracker(id: string): Promise<void> {
  const t = await db.trackers.get(id)
  if (!t || t.key !== 'custom') throw new Error('Only custom trackers can be deleted.')
  await db.transaction('rw', [db.trackers, db.readings], async () => {
    await db.trackers.delete(id)
    await db.readings.where('trackerId').equals(id).delete()
  })
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Wide-but-sane validation. Never blocks legitimate unusual values harshly; requires numeric where applicable. */
export function validateReading(tracker: HealthTracker, values: Record<string, number | string>): string | null {
  const req = (v: unknown, label: string) => (v == null || v === '' ? `${label} is required.` : null)
  switch (tracker.key) {
    case 'bp': {
      const s = num(values.systolic)
      const d = num(values.diastolic)
      if (s == null) return req(values.systolic, 'Systolic')
      if (d == null) return req(values.diastolic, 'Diastolic')
      if (s < 30 || s > 350) return 'Systolic looks out of range (30–350). Check the value.'
      if (d < 20 || d > 250) return 'Diastolic looks out of range (20–250). Check the value.'
      const p = num(values.pulse)
      if (p != null && (p < 20 || p > 300)) return 'Pulse looks out of range (20–300).'
      return null
    }
    case 'glucose': {
      const g = num(values.value)
      if (g == null) return values.value == null || values.value === '' ? 'Glucose value is required.' : 'Glucose value must be numeric.'
      if (g <= 0 || g > 2000) return 'Glucose value looks out of range. Check the value and unit.'
      return null
    }
    case 'weight': {
      const w = num(values.value)
      if (w == null) return values.value == null || values.value === '' ? 'Weight is required.' : 'Weight must be numeric.'
      if (w <= 0 || w > 1500) return 'Weight looks out of range. Check the value and unit.'
      return null
    }
    case 'hr': {
      const h = num(values.value)
      if (h == null) return values.value == null || values.value === '' ? 'Heart rate is required.' : 'Heart rate must be numeric.'
      if (h < 15 || h > 300) return 'Heart rate looks out of range (15–300).'
      return null
    }
    case 'spo2': {
      const s = num(values.value)
      if (s == null) return values.value == null || values.value === '' ? 'SpO2 is required.' : 'SpO2 must be numeric.'
      if (s <= 0 || s > 100) return 'SpO2 should be a percentage (1–100).'
      return null
    }
    case 'temp': {
      const t = num(values.value)
      if (t == null) return values.value == null || values.value === '' ? 'Temperature is required.' : 'Temperature must be numeric.'
      const unit = String(values.unit ?? tracker.unit ?? '°C')
      if (unit.includes('F')) {
        if (t < 50 || t > 122) return 'Temperature looks out of range (°F 50–122). Check the value.'
      } else if (t < 10 || t > 50) return 'Temperature looks out of range (°C 10–50). Check the value.'
      return null
    }
    case 'period': {
      if (!values.start) return 'Period start date is required.'
      if (values.end && String(values.end) < String(values.start)) return 'Period end date cannot be before start date.'
      const pain = num(values.pain)
      if (pain != null && (pain < 1 || pain > 10)) return 'Pain must be 1–10.'
      return null
    }
    case 'symptom': {
      if (!String(values.name ?? '').trim()) return 'Symptom name is required.'
      const sev = num(values.severity)
      if (sev == null) return 'Severity is required.'
      if (sev < 1 || sev > 10) return 'Severity must be 1–10.'
      return null
    }
    case 'custom': {
      for (const f of tracker.fieldsSchema ?? []) {
        const v = values[f.name]
        if (f.kind === 'number' && v != null && v !== '' && num(v) == null) return `${f.label} must be numeric.`
        if (f.kind === 'severity10' && v != null && v !== '') {
          const n = num(v)
          if (n == null || n < 1 || n > 10) return `${f.label} must be 1–10.`
        }
        if (f.kind === 'quality5' && v != null && v !== '') {
          const n = num(v)
          if (n == null || n < 1 || n > 5) return `${f.label} must be 1–5.`
        }
      }
      return null
    }
  }
}

export interface ReadingInput {
  trackerId: string
  timestamp: number
  values: Record<string, number | string>
  context?: string
  notes?: string
}

export async function addReading(input: ReadingInput): Promise<HealthReading> {
  const tracker = await db.trackers.get(input.trackerId)
  if (!tracker) throw new Error('Tracker not found.')
  const err = validateReading(tracker, input.values)
  if (err) throw new Error(err)
  const r: HealthReading = { id: newId('rdg'), ...input }
  await db.readings.add(r)
  return r
}

export async function updateReading(id: string, patch: Partial<ReadingInput>): Promise<void> {
  const r = await db.readings.get(id)
  if (!r) throw new Error('Reading not found.')
  const tracker = await db.trackers.get(r.trackerId)
  if (!tracker) throw new Error('Tracker not found.')
  const next = { ...r, ...patch, values: patch.values ?? r.values }
  const err = validateReading(tracker, next.values)
  if (err) throw new Error(err)
  await db.readings.put(next)
}

export async function deleteReading(id: string): Promise<void> {
  await db.readings.delete(id)
}

export async function latestReading(trackerId: string): Promise<HealthReading | null> {
  const rows = await db.readings.where('trackerId').equals(trackerId).toArray()
  if (rows.length === 0) return null
  return rows.sort((a, b) => b.timestamp - a.timestamp)[0]
}

export async function readingsInRange(trackerId: string, fromMs: number, toMs: number): Promise<HealthReading[]> {
  const rows = await db.readings.where('trackerId').equals(trackerId).toArray()
  return rows.filter((r) => r.timestamp >= fromMs && r.timestamp <= toMs).sort((a, b) => a.timestamp - b.timestamp)
}

export async function recentReadings(limit = 8): Promise<{ tracker: HealthTracker; reading: HealthReading }[]> {
  const [trackers, readings] = await Promise.all([db.trackers.toArray(), db.readings.orderBy('timestamp').reverse().limit(limit * 2).toArray()])
  const byId = new Map(trackers.map((t) => [t.id, t]))
  const out: { tracker: HealthTracker; reading: HealthReading }[] = []
  for (const r of readings) {
    const t = byId.get(r.trackerId)
    if (t) out.push({ tracker: t, reading: r })
    if (out.length >= limit) break
  }
  return out
}

// ---- display helpers (neutral, no diagnosis) ----

export function formatReadingSummary(t: HealthTracker, r: HealthReading, settings?: AppSettings): string {
  const v = r.values
  switch (t.key) {
    case 'bp': return `${v.systolic} / ${v.diastolic} mmHg${v.pulse ? ` · pulse ${v.pulse}` : ''}`
    case 'glucose': {
      const unit = String(v.unit ?? settings?.glucoseUnit ?? 'mg/dL')
      return `${v.value} ${unit}`
    }
    case 'weight': {
      const unit = String(v.unit ?? settings?.weightUnit ?? 'kg')
      return `${v.value} ${unit}`
    }
    case 'hr': return `${v.value} bpm`
    case 'spo2': return `${v.value}%${v.pulse ? ` · pulse ${v.pulse}` : ''}`
    case 'temp': {
      const unit = String(v.unit ?? (settings?.tempUnit === 'F' ? '°F' : '°C'))
      return `${v.value} ${unit}`
    }
    case 'period': return `Period ${v.start}${v.end ? ` → ${v.end}` : ''}${v.flow ? ` · ${v.flow}` : ''}`
    case 'symptom': return `${v.name} · ${v.severity}/10`
    case 'custom': {
      const parts: string[] = []
      for (const f of t.fieldsSchema ?? []) {
        const val = v[f.name]
        if (val != null && val !== '') parts.push(`${f.label}: ${val}${f.unit ? ` ${f.unit}` : ''}`)
      }
      return parts.slice(0, 3).join(' · ') || t.name
    }
  }
}

export function relativeDay(ts: number, now = Date.now()): string {
  const d = new Date(ts)
  const today = new Date(now)
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  if (sameDay) return 'today'
  const y = new Date(today)
  y.setDate(y.getDate() - 1)
  if (d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()) return 'yesterday'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(d)
}

/** Current cycle day from period readings (days since latest start + 1). No predictions. */
export function cycleDay(periodReadings: HealthReading[], now = new Date()): number | null {
  const starts = periodReadings
    .map((r) => String(r.values.start ?? ''))
    .filter(Boolean)
    .sort()
  if (starts.length === 0) return null
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const past = starts.filter((s) => s <= todayStr)
  if (past.length === 0) return null
  const last = past[past.length - 1]
  const [y, m, d] = last.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  return Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - start.getTime()) / 86400000) + 1
}

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null
  const m = heightCm / 100
  return weightKg / (m * m)
}

export const toKg = (v: number, unit: string) => (unit === 'lb' ? v * 0.45359237 : v)
export const fromKg = (kg: number, unit: string) => (unit === 'lb' ? kg / 0.45359237 : kg)

export function useTrackers() {
  const [data, setData] = useState<HealthTracker[]>([])
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setData(await listTrackers())
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  return { data, loading, refresh }
}
