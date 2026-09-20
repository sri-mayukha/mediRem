import { describe, expect, it } from 'vitest'
import { MAX_SNOOZES, snoozeAllowed } from '../db/medications'
import { courseInfo } from './course'
import { occurrencesForDay } from './schedule'
import { addDays, combineDateTime, parseLocalDateStr, toLocalDateStr } from './time'
import type { Medication, MedicationSchedule } from '../types'

const med = (over: Partial<Medication> = {}): Medication => ({
  id: 'm1', name: 'Edge', form: 'tablet', doseAmount: 1, doseUnit: 'tablet',
  qtyPerDose: 1, status: 'active', createdAt: 0, updatedAt: 0, ...over,
})
const sched = (over: Partial<MedicationSchedule> = {}): MedicationSchedule => ({
  id: 's1', medicationId: 'm1', type: 'once_daily', times: ['08:00'], startDate: '2026-09-20', ...over,
})
const byId = (m: Medication) => new Map([[m.id, m]])

describe('time edges (spec §61)', () => {
  it('date round-trips, including leap day', () => {
    for (const s of ['2026-09-20', '2024-02-29', '2026-12-31', '2027-01-01']) {
      expect(toLocalDateStr(parseLocalDateStr(s))).toBe(s)
    }
  })
  it('addDays crosses month and year boundaries', () => {
    expect(toLocalDateStr(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01')
    expect(toLocalDateStr(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01')
  })
  it('combineDateTime keeps local wall-clock time', () => {
    // A device clock or TZ shift must not move the wall-clock dose time.
    const at = combineDateTime(new Date(2026, 8, 20), '20:00')
    const d = new Date(at)
    expect(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`).toBe('20:00')
  })
  it('end date is inclusive; day after is empty', () => {
    const s = sched({ startDate: '2026-09-20', endDate: '2026-09-21' })
    expect(occurrencesForDay(new Date(2026, 8, 21), [s], byId(med()))).toHaveLength(1)
    expect(occurrencesForDay(new Date(2026, 8, 22), [s], byId(med()))).toHaveLength(0)
  })
  it('future start date generates nothing before start', () => {
    const s = sched({ startDate: '2026-10-01' })
    expect(occurrencesForDay(new Date(2026, 8, 20), [s], byId(med()))).toHaveLength(0)
  })
  it('weekly wraps the weekend correctly (Sun=0, Sat=6)', () => {
    const s = sched({ type: 'weekly', times: ['09:00'], daysOfWeek: [0], startDate: '2026-09-01' })
    expect(occurrencesForDay(new Date(2026, 8, 19), [s], byId(med()))).toHaveLength(0) // Saturday
    expect(occurrencesForDay(new Date(2026, 8, 20), [s], byId(med()))).toHaveLength(1) // Sunday
  })
  it('interval schedule continues across midnight without gaps', () => {
    const s = sched({ type: 'interval_hours', times: ['06:00'], intervalHours: 8, startDate: '2026-09-20' })
    const m = byId(med())
    const day1 = occurrencesForDay(new Date(2026, 8, 20), [s], m)
    const day2 = occurrencesForDay(new Date(2026, 8, 21), [s], m)
    expect(day1.length).toBe(3) // 06:00, 14:00, 22:00
    expect(day2.length).toBe(3) // 06:00, 14:00, 22:00 — no drift
    expect(day2[0].at - day1[2].at).toBe(8 * 3600000)
  })
  it('course spans month boundaries', () => {
    const info = courseInfo(med(), [sched({ startDate: '2026-09-30', endDate: '2026-10-02' })], new Date(2026, 8, 30, 12))
    expect(info.totalDays).toBe(3)
    expect(info.label).toBe('Day 1 of 3')
  })
})

describe('notification loop guards (spec §27)', () => {
  it('snooze cap is 5 and pure guard agrees', () => {
    expect(MAX_SNOOZES).toBe(5)
    expect(snoozeAllowed(undefined)).toBe(true)
    expect(snoozeAllowed(4)).toBe(true)
    expect(snoozeAllowed(5)).toBe(false)
    expect(snoozeAllowed(99)).toBe(false)
  })
})
