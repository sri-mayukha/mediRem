import type { Medication, MedicationSchedule } from '../types'
import { addDays, combineDateTime, parseLocalDateStr, parseTimeToMinutes, startOfDay, toLocalDateStr } from './time'

export interface Occurrence {
  scheduleId: string
  medicationId: string
  at: number
  timeLabel: string
}

function inDateRange(schedule: MedicationSchedule, day: Date): boolean {
  const dayStr = toLocalDateStr(day)
  if (dayStr < schedule.startDate) return false
  if (schedule.endDate && dayStr > schedule.endDate) return false
  return true
}

function isMedicationSchedulable(med: Medication | undefined): boolean {
  return !!med && med.status === 'active'
}

export function occurrencesForDay(
  day: Date,
  schedules: MedicationSchedule[],
  medsById: Map<string, Medication>,
): Occurrence[] {
  const out: Occurrence[] = []
  const dayStart = startOfDay(day)
  for (const s of schedules) {
    if (s.type === 'sos') continue // SOS never auto-generates
    if (!isMedicationSchedulable(medsById.get(s.medicationId))) continue
    if (!inDateRange(s, dayStart)) continue

    if (s.type === 'once_daily' || s.type === 'multi_daily') {
      for (const t of s.times) {
        out.push({ scheduleId: s.id, medicationId: s.medicationId, at: combineDateTime(dayStart, t), timeLabel: t })
      }
    } else if (s.type === 'weekly') {
      if (!s.daysOfWeek || s.daysOfWeek.length === 0) continue
      if (!s.daysOfWeek.includes(dayStart.getDay())) continue
      for (const t of s.times) {
        out.push({ scheduleId: s.id, medicationId: s.medicationId, at: combineDateTime(dayStart, t), timeLabel: t })
      }
    } else if (s.type === 'interval_hours') {
      const every = s.intervalHours && s.intervalHours > 0 ? s.intervalHours : 8
      const anchorTimes = s.times.length > 0 ? s.times : ['08:00']
      // Anchor on start date, then step by interval. Emit those falling on `day`.
      const anchorDay = parseLocalDateStr(s.startDate)
      const anchorAt = combineDateTime(anchorDay, anchorTimes[0])
      const dayEnd = dayStart.getTime() + 86400000
      // Find first k with anchorAt + k*every*3600e3 >= dayStart
      const step = every * 3600000
      let k = Math.floor((dayStart.getTime() - anchorAt) / step)
      for (let i = k - 1; i < k + 40; i++) {
        const at = anchorAt + i * step
        if (at >= dayStart.getTime() && at < dayEnd) {
          const d = new Date(at)
          const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          out.push({ scheduleId: s.id, medicationId: s.medicationId, at, timeLabel: label })
        }
        if (at >= dayEnd) break
      }
      void parseTimeToMinutes // keep import used if tree-shaken differently
    }
  }
  out.sort((a, b) => a.at - b.at)
  return out
}

/** Earliest occurrence strictly after `fromMs`, scanning up to 60 days. */
export function nextOccurrence(
  fromMs: number,
  schedules: MedicationSchedule[],
  medsById: Map<string, Medication>,
): Occurrence | null {
  const from = new Date(fromMs)
  for (let d = 0; d < 60; d++) {
    const day = d === 0 ? from : addDays(startOfDay(from), d)
    const occs = occurrencesForDay(day, schedules, medsById).filter((o) => o.at > fromMs)
    if (occs.length > 0) return occs[0]
  }
  return null
}

export function previousOccurrence(
  beforeMs: number,
  schedules: MedicationSchedule[],
  medsById: Map<string, Medication>,
): Occurrence | null {
  const before = new Date(beforeMs)
  for (let d = 0; d < 60; d++) {
    const day = d === 0 ? before : addDays(startOfDay(before), -d)
    const occs = occurrencesForDay(day, schedules, medsById)
      .filter((o) => o.at < beforeMs)
      .sort((a, b) => b.at - a.at)
    if (occs.length > 0) return occs[0]
  }
  return null
}

/** Expected doses on a given day for course math. */
export function expectedDosesForDay(schedule: MedicationSchedule, day: Date): number {
  if (schedule.type === 'sos') return 0
  if (schedule.type === 'once_daily') return 1
  if (schedule.type === 'multi_daily' || schedule.type === 'weekly') {
    if (schedule.type === 'weekly' && schedule.daysOfWeek && !schedule.daysOfWeek.includes(startOfDay(day).getDay())) return 0
    return schedule.times.length
  }
  if (schedule.type === 'interval_hours') {
    const every = schedule.intervalHours && schedule.intervalHours > 0 ? schedule.intervalHours : 8
    return Math.max(1, Math.round(24 / every))
  }
  return 0
}
