import { describe, expect, it } from 'vitest'
import type { Medication, MedicationSchedule } from '../types'
import { adherence } from './adherence'
import { courseInfo } from './course'
import { daysRemaining, dosesRemaining, refillNewQty, refillState } from './inventory'
import { nextOccurrence, occurrencesForDay, previousOccurrence } from './schedule'
import { combineDateTime } from './time'

const med = (over: Partial<Medication> = {}): Medication => ({
  id: 'm1', name: 'Metformin', form: 'tablet', doseAmount: 1, doseUnit: 'tablet',
  qtyPerDose: 1, status: 'active', createdAt: 0, updatedAt: 0, ...over,
})
const sched = (over: Partial<MedicationSchedule> = {}): MedicationSchedule => ({
  id: 's1', medicationId: 'm1', type: 'once_daily', times: ['08:00'], startDate: '2026-09-20', ...over,
})

describe('schedule', () => {
  it('generates daily occurrences sorted', () => {
    const occs = occurrencesForDay(new Date(2026, 8, 20, 12), [sched({ times: ['08:00', '20:00'], type: 'multi_daily' })], new Map([['m1', med()]]))
    expect(occs.map((o) => o.timeLabel)).toEqual(['08:00', '20:00'])
  })
  it('respects weekly days', () => {
    // 2026-09-20 is a Sunday (0)
    const s = sched({ type: 'weekly', times: ['09:00'], daysOfWeek: [1, 3, 5] })
    expect(occurrencesForDay(new Date(2026, 8, 20), [s], new Map([['m1', med()]]))).toHaveLength(0)
    expect(occurrencesForDay(new Date(2026, 8, 21), [s], new Map([['m1', med()]]))).toHaveLength(1) // Monday
  })
  it('interval schedule emits same-day slots', () => {
    const s = sched({ type: 'interval_hours', times: ['08:00'], intervalHours: 8, startDate: '2026-09-20' })
    const occs = occurrencesForDay(new Date(2026, 8, 20), [s], new Map([['m1', med()]]))
    expect(occs.length).toBeGreaterThanOrEqual(2)
  })
  it('SOS never auto-generates', () => {
    const s = sched({ type: 'sos', times: ['08:00'] })
    expect(occurrencesForDay(new Date(2026, 8, 20), [s], new Map([['m1', med()]]))).toHaveLength(0)
  })
  it('next/previous occurrence + start/end dates', () => {
    const s = sched({ times: ['20:00'], startDate: '2026-09-20', endDate: '2026-09-21' })
    const byId = new Map([['m1', med()]])
    const next = nextOccurrence(new Date(2026, 8, 20, 19, 0).getTime(), [s], byId)
    expect(next).not.toBeNull()
    expect(new Date(next!.at).getHours()).toBe(20)
    const pastEnd = nextOccurrence(new Date(2026, 8, 22).getTime(), [s], byId)
    expect(pastEnd).toBeNull()
    const prev = previousOccurrence(new Date(2026, 8, 20, 21, 0).getTime(), [s], byId)
    expect(prev).not.toBeNull()
  })
  it('ignores paused medications', () => {
    const occs = occurrencesForDay(new Date(2026, 8, 20), [sched()], new Map([['m1', med({ status: 'paused' })]]))
    expect(occs).toHaveLength(0)
  })
  it('snooze/missed flow helper: combineDateTime is local', () => {
    const at = combineDateTime(new Date(2026, 8, 20), '20:00')
    expect(new Date(at).getHours()).toBe(20)
  })
})

describe('course', () => {
  it('fixed 14-day course reports day + totals', () => {
    const m = med()
    const s = [sched({ startDate: '2026-09-20', endDate: '2026-10-03', times: ['08:00', '20:00'], type: 'multi_daily' })]
    const info = courseInfo(m, s, new Date(2026, 8, 23, 12))
    expect(info.totalDays).toBe(14)
    expect(info.currentDay).toBe(4)
    expect(info.label).toBe('Day 4 of 14')
    expect(info.totalExpectedDoses).toBe(28)
  })
  it('completes after end date and never auto-extends', () => {
    const info = courseInfo(med(), [sched({ startDate: '2026-09-01', endDate: '2026-09-05' })], new Date(2026, 8, 20))
    expect(info.isComplete).toBe(true)
    expect(info.label).toBe('Course completed')
  })
  it('ongoing has no end', () => {
    const info = courseInfo(med(), [sched({ startDate: '2026-09-01' })], new Date(2026, 8, 20))
    expect(info.kind).toBe('ongoing')
    expect(info.totalDays).toBeNull()
  })
})

describe('inventory', () => {
  it('30 tabs twice-daily: 15 days, refill at 7 days', () => {
    const m = med({ currentQty: 30, qtyPerDose: 1, refillThresholdDays: 7 })
    const s = [sched({ type: 'multi_daily', times: ['08:00', '20:00'] })]
    expect(dosesRemaining(m)).toBe(30)
    expect(daysRemaining(m, s)).toBe(15)
    expect(refillState(m, s).due).toBe(false)
    const low = med({ currentQty: 10, qtyPerDose: 1, refillThresholdDays: 7 })
    const st = refillState(low, s)
    expect(st.due).toBe(true)
    expect(st.reason).toMatch(/5 day/)
  })
  it('dose-threshold triggers', () => {
    const m = med({ currentQty: 4, qtyPerDose: 1, refillThresholdDoses: 5 })
    expect(refillState(m, [sched()]).due).toBe(true)
  })
  it('refill math prev+added=new', () => {
    expect(refillNewQty(2, 30)).toBe(32)
    expect(() => refillNewQty(2, 0)).toThrow()
  })
})

describe('adherence neutral copy', () => {
  it('18/21 no shame language', () => {
    const events = [
      ...Array.from({ length: 18 }, () => ({ status: 'taken' as const })),
      ...Array.from({ length: 2 }, () => ({ status: 'skipped' as const })),
      { status: 'missed' as const },
    ]
    const s = adherence(events)
    expect(s.label).toBe('18 / 21 doses recorded')
    expect(s.percent).toBe(86)
  })
})
