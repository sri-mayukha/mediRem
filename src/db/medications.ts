import { useCallback, useEffect, useState } from 'react'
import type {
  Medication,
  MedicationDoseEvent,
  MedicationRefill,
  MedicationSchedule,
  MedicationStatus,
} from '../types'
import { newId } from '../lib/ids'
import { nextOccurrence, occurrencesForDay } from '../lib/schedule'
import { combineDateTime, toLocalDateStr } from '../lib/time'
import { db } from './database'

export interface MedicationInput extends Omit<Medication, 'id' | 'createdAt' | 'updatedAt'> {}
export interface ScheduleInput extends Omit<MedicationSchedule, 'id' | 'medicationId'> {}

export function validateMedication(m: Partial<Medication>, s: Partial<MedicationSchedule>): string | null {
  if (!m.name || m.name.trim().length === 0) return 'Medication name is required.'
  if (!(m.doseAmount != null && Number(m.doseAmount) > 0)) return 'Dose amount must be greater than zero.'
  if (!(m.qtyPerDose != null && Number(m.qtyPerDose) > 0)) return 'Quantity per dose must be greater than zero.'
  if (m.initialQty != null && m.initialQty < 0) return 'Quantity cannot be negative.'
  if (m.currentQty != null && m.currentQty < 0) return 'Quantity cannot be negative.'
  if (!s.startDate) return 'Start date is required.'
  if (s.endDate && s.endDate < s.startDate) return 'Course end date cannot be before start date.'
  if ((!s.times || s.times.length === 0) && s.type !== 'sos' && s.type !== 'interval_hours') return 'Add at least one time.'
  if (s.type === 'weekly' && (!s.daysOfWeek || s.daysOfWeek.length === 0)) return 'Choose at least one day.'
  if (s.type === 'interval_hours' && !(s.intervalHours && s.intervalHours > 0)) return 'Interval must be greater than zero.'
  return null
}

export async function createMedicationWithSchedule(
  med: MedicationInput,
  sched: ScheduleInput,
): Promise<{ med: Medication; schedule: MedicationSchedule }> {
  const err = validateMedication(med, sched)
  if (err) throw new Error(err)
  const now = Date.now()
  const full: Medication = {
    ...med,
    name: med.name.trim(),
    id: newId('med'),
    status: med.status ?? 'active',
    createdAt: now,
    updatedAt: now,
    currentQty: med.currentQty ?? med.initialQty,
  }
  const fullSched: MedicationSchedule = { ...sched, id: newId('sch'), medicationId: full.id }
  await db.transaction('rw', [db.medications, db.schedules], async () => {
    await db.medications.add(full)
    await db.schedules.add(fullSched)
  })
  return { med: full, schedule: fullSched }
}

export async function updateMedicationWithSchedule(
  medId: string,
  medPatch: Partial<Medication>,
  schedPatch: Partial<MedicationSchedule>,
): Promise<void> {
  const med = await db.medications.get(medId)
  if (!med) throw new Error('Medication not found.')
  const sched = await db.schedules.where('medicationId').equals(medId).first()
  const nextMed = { ...med, ...medPatch, name: (medPatch.name ?? med.name).trim(), updatedAt: Date.now() }
  const nextSched = sched ? { ...sched, ...schedPatch } : null
  const err = validateMedication(nextMed, nextSched ?? { startDate: toLocalDateStr(new Date()), type: 'once_daily', times: [] })
  if (err) throw new Error(err)
  await db.transaction('rw', [db.medications, db.schedules], async () => {
    await db.medications.put(nextMed)
    if (nextSched) await db.schedules.put(nextSched)
  })
}

export async function setMedicationStatus(id: string, status: MedicationStatus): Promise<void> {
  const med = await db.medications.get(id)
  if (!med) return
  await db.medications.put({ ...med, status, updatedAt: Date.now() })
}

/** Remove from active list but preserve dose/refill history. */
export async function removeMedication(id: string): Promise<void> {
  await db.transaction('rw', [db.medications, db.schedules], async () => {
    await db.medications.delete(id)
    await db.schedules.where('medicationId').equals(id).delete()
  })
}

export async function listMedications(status?: MedicationStatus): Promise<Medication[]> {
  const all = status
    ? await db.medications.where('status').equals(status).toArray()
    : await db.medications.toArray()
  return all.sort((a, b) => a.name.localeCompare(b.name))
}

export async function searchMedications(q: string): Promise<Medication[]> {
  const needle = q.trim().toLowerCase()
  const all = await db.medications.toArray()
  if (!needle) return all.sort((a, b) => a.name.localeCompare(b.name))
  return all
    .filter((m) => [m.name, m.genericName ?? '', m.brandName ?? ''].some((f) => f.toLowerCase().includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getSchedules(medicationId: string): Promise<MedicationSchedule[]> {
  return db.schedules.where('medicationId').equals(medicationId).toArray()
}

export async function listAllSchedules(): Promise<MedicationSchedule[]> {
  return db.schedules.toArray()
}

/** Stable event id per occurrence so re-renders don't duplicate. */
export function eventIdFor(medicationId: string, scheduleId: string, at: number): string {
  return `evt_${medicationId}_${scheduleId}_${at}`
}

export async function ensureEvent(medicationId: string, scheduleId: string, at: number): Promise<MedicationDoseEvent> {
  const id = eventIdFor(medicationId, scheduleId, at)
  const existing = await db.doseEvents.get(id)
  if (existing) return existing
  const evt: MedicationDoseEvent = { id, medicationId, scheduleId, scheduledAt: at, status: 'upcoming' }
  await db.doseEvents.add(evt)
  return evt
}

export async function markTaken(eventId: string, note?: string): Promise<void> {
  const e = await db.doseEvents.get(eventId)
  if (!e) throw new Error('Dose not found.')
  const med = await db.medications.get(e.medicationId)
  const now = Date.now()
  await db.transaction('rw', [db.doseEvents, db.medications], async () => {
    await db.doseEvents.put({ ...e, status: 'taken', takenAt: now, note: note ?? e.note })
    // Decrement stock once when transitioning into taken (never double-decrement).
    if (med && e.status !== 'taken' && med.currentQty != null && med.qtyPerDose > 0) {
      await db.medications.put({ ...med, currentQty: Math.max(0, med.currentQty - med.qtyPerDose), updatedAt: now })
    }
  })
}

export async function markSkipped(eventId: string, note?: string): Promise<void> {
  const e = await db.doseEvents.get(eventId)
  if (!e) return
  await db.doseEvents.put({ ...e, status: 'skipped', note: note ?? e.note })
}

/** Max consecutive snoozes per dose — avoids uncontrolled notification loops (spec §27). */
export const MAX_SNOOZES = 5

/** Pure guard, unit-tested. */
export function snoozeAllowed(count: number | undefined): boolean {
  return (count ?? 0) < MAX_SNOOZES
}

/** Returns false when the snooze cap is reached (caller should inform the user). */
export async function snoozeEvent(eventId: string, snoozeMinutes: number): Promise<boolean> {
  const e = await db.doseEvents.get(eventId)
  if (!e) return false
  if (!snoozeAllowed(e.snoozeCount)) return false
  await db.doseEvents.put({
    ...e,
    status: 'snoozed',
    snoozedUntil: Date.now() + snoozeMinutes * 60000,
    snoozeCount: (e.snoozeCount ?? 0) + 1,
  })
  return true
}

/** Sweep upcoming/due past grace -> missed. Returns count changed. */
export async function applyMissedSweep(nowMs: number, graceMinutes: number): Promise<number> {
  const cutoff = nowMs - graceMinutes * 60000
  const candidates = await db.doseEvents.where('status').anyOf(['upcoming', 'due', 'snoozed']).toArray()
  let changed = 0
  for (const e of candidates) {
    const effectiveAt = e.status === 'snoozed' && e.snoozedUntil ? e.snoozedUntil : e.scheduledAt
    if (effectiveAt < cutoff) {
      await db.doseEvents.put({ ...e, status: 'missed' })
      changed += 1
    }
  }
  return changed
}

export async function recordSosIntake(medicationId: string, scheduleId: string, at = Date.now(), note?: string): Promise<void> {
  const med = await db.medications.get(medicationId)
  const id = `evt_${medicationId}_${scheduleId}_${at}`
  await db.transaction('rw', [db.doseEvents, db.medications], async () => {
    await db.doseEvents.put({ id, medicationId, scheduleId, scheduledAt: at, status: 'taken', takenAt: at, note })
    if (med && med.currentQty != null && med.qtyPerDose > 0) {
      await db.medications.put({ ...med, currentQty: Math.max(0, med.currentQty - med.qtyPerDose), updatedAt: at })
    }
  })
}

export async function listEvents(fromMs: number, toMs: number): Promise<MedicationDoseEvent[]> {
  return db.doseEvents.where('scheduledAt').between(fromMs, toMs, true, true).toArray()
}

export async function recordRefill(medicationId: string, addedQty: number): Promise<MedicationRefill> {
  if (!(addedQty > 0)) throw new Error('Refill quantity must be greater than zero.')
  const med = await db.medications.get(medicationId)
  if (!med) throw new Error('Medication not found.')
  const prev = med.currentQty ?? 0
  const refill: MedicationRefill = { id: newId('ref'), medicationId, prevQty: prev, addedQty, newQty: prev + addedQty, at: Date.now() }
  await db.transaction('rw', [db.medications, db.refills], async () => {
    await db.refills.add(refill)
    await db.medications.put({ ...med, currentQty: refill.newQty, updatedAt: refill.at, initialQty: med.initialQty ?? prev })
  })
  return refill
}

export async function correctQuantity(medicationId: string, newQty: number): Promise<void> {
  if (!(newQty >= 0)) throw new Error('Quantity cannot be negative.')
  const med = await db.medications.get(medicationId)
  if (!med) return
  await db.medications.put({ ...med, currentQty: newQty, updatedAt: Date.now() })
}

export async function listRefills(medicationId: string): Promise<MedicationRefill[]> {
  return db.refills.where('medicationId').equals(medicationId).reverse().sortBy('at')
}

/** Build today's hydrated timeline entries (occurrences + persisted event status). */
export async function todayTimeline(now = new Date()) {
  const meds = await db.medications.toArray()
  const medsById = new Map(meds.map((m) => [m.id, m]))
  const schedules = await db.schedules.toArray()
  const occs = occurrencesForDay(now, schedules, medsById)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const events = await listEvents(start, start + 86400000)
  const byOcc = new Map(events.map((e) => [`${e.medicationId}|${e.scheduleId}|${e.scheduledAt}`, e]))
  return occs.map((o) => ({
    ...o,
    med: medsById.get(o.medicationId)!,
    event: byOcc.get(`${o.medicationId}|${o.scheduleId}|${o.at}`) ?? null,
  }))
}

/** Next upcoming occurrence + med. */
export async function nextDose(nowMs = Date.now()) {
  const meds = await db.medications.toArray()
  const byId = new Map(meds.map((m) => [m.id, m]))
  const schedules = await db.schedules.toArray()
  const occ = nextOccurrence(nowMs, schedules, byId)
  if (!occ) return null
  return { ...occ, med: byId.get(occ.medicationId)! }
}

export function useMedications(status?: MedicationStatus, query = '') {
  const [data, setData] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = query ? await searchMedications(query) : await listMedications(status)
      setData(status && query ? rows.filter((r) => r.status === status) : rows)
    } finally {
      setLoading(false)
    }
  }, [status, query])
  useEffect(() => {
    void refresh()
  }, [refresh])
  return { data, loading, refresh }
}

export function doseLabel(m: Medication): string {
  return `${m.doseAmount} ${m.doseUnit}`
}

export function scheduleSummary(s: MedicationSchedule): string {
  if (s.type === 'sos') return 'As needed'
  if (s.type === 'once_daily') return `${s.times[0] ?? ''} daily`
  if (s.type === 'multi_daily') return `${s.times.join(' · ')} daily`
  if (s.type === 'weekly') {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `${s.times.join(' · ')} · ${(s.daysOfWeek ?? []).map((d) => names[d]).join('/')}`
  }
  return `Every ${s.intervalHours}h`
}

export function todayStr(): string {
  return toLocalDateStr(new Date())
}

export function defaultStartDate(): string {
  return toLocalDateStr(new Date())
}

export function combineForToday(hhmm: string): number {
  return combineDateTime(new Date(), hhmm)
}
