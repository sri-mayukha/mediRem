import type { Medication, MedicationSchedule } from '../types'
import { expectedDosesForDay } from './schedule'
import { addDays, diffDays, parseLocalDateStr, toLocalDateStr } from './time'

export interface CourseInfo {
  kind: 'fixed' | 'ongoing'
  currentDay: number | null // 1-based, null if not started
  totalDays: number | null
  remainingDays: number | null
  completionDateStr: string | null
  totalExpectedDoses: number | null
  isComplete: boolean
  label: string // e.g. "Day 4 of 14"
}

/** Course derived from schedule start/end. Ongoing when no endDate. */
export function courseInfo(
  med: Medication,
  schedules: MedicationSchedule[],
  now = new Date(),
): CourseInfo {
  const starts = schedules.map((s) => s.startDate).sort()
  const ends = schedules.filter((s) => s.endDate).map((s) => s.endDate as string).sort()
  const startStr = starts[0]
  const endStr = ends.length > 0 ? ends[ends.length - 1] : undefined

  if (!startStr) {
    return { kind: 'ongoing', currentDay: null, totalDays: null, remainingDays: null, completionDateStr: null, totalExpectedDoses: null, isComplete: false, label: 'Ongoing' }
  }
  if (!endStr) {
    const start = parseLocalDateStr(startStr)
    const elapsed = Math.max(0, diffDays(start, now) + 1)
    return {
      kind: 'ongoing', currentDay: elapsed, totalDays: null, remainingDays: null,
      completionDateStr: null, totalExpectedDoses: null, isComplete: false, label: `Day ${elapsed} · ongoing`,
    }
  }
  const start = parseLocalDateStr(startStr)
  const end = parseLocalDateStr(endStr)
  const totalDays = diffDays(start, end) + 1
  const todayStr = toLocalDateStr(now)
  const isComplete = todayStr > endStr || med.status === 'completed'

  let totalExpected: number | null = 0
  for (let d = 0; d < totalDays; d++) {
    const day = addDays(start, d)
    for (const s of schedules) {
      if (day < parseLocalDateStr(s.startDate)) continue
      if (s.endDate && day > parseLocalDateStr(s.endDate)) continue
      totalExpected += expectedDosesForDay(s, day)
    }
  }

  if (todayStr < startStr) {
    return { kind: 'fixed', currentDay: null, totalDays, remainingDays: totalDays, completionDateStr: endStr, totalExpectedDoses: totalExpected, isComplete: false, label: `Starts in ${diffDays(now, start)} days` }
  }
  const currentDay = Math.min(totalDays, diffDays(start, now) + 1)
  const remainingDays = isComplete ? 0 : totalDays - currentDay
  const label = isComplete ? 'Course completed' : `Day ${currentDay} of ${totalDays}`
  return { kind: 'fixed', currentDay, totalDays, remainingDays, completionDateStr: endStr, totalExpectedDoses: totalExpected, isComplete, label }
}
