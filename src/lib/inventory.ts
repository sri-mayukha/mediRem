import type { Medication, MedicationSchedule } from '../types'
import { expectedDosesForDay } from './schedule'

/** Average doses per day across schedules (for estimates). */
export function dosesPerDay(schedules: MedicationSchedule[]): number {
  let total = 0
  for (const s of schedules) {
    if (s.type === 'sos') continue
    if (s.type === 'once_daily') total += 1
    else if (s.type === 'multi_daily') total += s.times.length
    else if (s.type === 'weekly') {
      const days = s.daysOfWeek && s.daysOfWeek.length > 0 ? s.daysOfWeek.length : 0
      total += (s.times.length * days) / 7
    } else if (s.type === 'interval_hours') {
      const every = s.intervalHours && s.intervalHours > 0 ? s.intervalHours : 8
      total += 24 / every
    }
  }
  return total
}

export function dosesRemaining(med: Medication): number | null {
  if (med.currentQty == null || med.qtyPerDose <= 0) return null
  return Math.max(0, Math.floor(med.currentQty / med.qtyPerDose))
}

export function daysRemaining(med: Medication, schedules: MedicationSchedule[]): number | null {
  const perDay = dosesPerDay(schedules)
  if (perDay <= 0) return null
  const doses = dosesRemaining(med)
  if (doses == null) return null
  return Math.floor(doses / perDay)
}

export interface RefillState {
  due: boolean
  daysLeft: number | null
  dosesLeft: number | null
  reason: string | null // neutral copy, e.g. "Approximately 5 days remaining."
}

export function refillState(med: Medication, schedules: MedicationSchedule[]): RefillState {
  const dosesLeft = dosesRemaining(med)
  const daysLeft = daysRemaining(med, schedules)
  let due = false
  if (dosesLeft != null && med.refillThresholdDoses != null && dosesLeft <= med.refillThresholdDoses) due = true
  if (daysLeft != null && med.refillThresholdDays != null && daysLeft <= med.refillThresholdDays) due = true
  let reason: string | null = null
  if (due) {
    if (daysLeft != null) reason = `Approximately ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining.`
    else if (dosesLeft != null) reason = `Approximately ${dosesLeft} dose${dosesLeft === 1 ? '' : 's'} remaining.`
  }
  return { due, daysLeft, dosesLeft, reason }
}

/** Validate refill entry: new = prev + added. */
export function refillNewQty(prevQty: number, addedQty: number): number {
  if (prevQty < 0 || addedQty <= 0) throw new Error('Quantities must be positive.')
  return prevQty + addedQty
}

export { expectedDosesForDay }
