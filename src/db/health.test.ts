import { describe, expect, it } from 'vitest'
import { toLinePoints } from '../components/health/Chart'
import { bmi, cycleDay, fromKg, validateReading } from './health'
import type { HealthTracker } from '../types'

const t = (key: HealthTracker['key'], extra = {}): HealthTracker => ({
  id: `tracker_${key}`, key, name: key, active: true, createdAt: 0, ...extra,
})

describe('health validation', () => {
  it('bp requires systolic/diastolic, wide ranges', () => {
    expect(validateReading(t('bp'), { systolic: '', diastolic: 76 })).toMatch(/Systolic/)
    expect(validateReading(t('bp'), { systolic: 118, diastolic: 76 })).toBeNull()
    expect(validateReading(t('bp'), { systolic: 5, diastolic: 76 })).toMatch(/out of range/)
  })
  it('spo2 must be percentage', () => {
    expect(validateReading(t('spo2'), { value: 98 })).toBeNull()
    expect(validateReading(t('spo2'), { value: 101 })).toMatch(/percentage/)
  })
  it('weight/temperature numeric', () => {
    expect(validateReading(t('weight'), { value: 'abc' })).toMatch(/required|numeric|Weight/)
    expect(validateReading(t('weight'), { value: 64.2 })).toBeNull()
    expect(validateReading(t('temp'), { value: 37, unit: '°C' })).toBeNull()
  })
  it('period end cannot precede start; symptom severity 1-10', () => {
    expect(validateReading(t('period'), { start: '2026-09-20', end: '2026-09-18' })).toMatch(/before start/)
    expect(validateReading(t('period'), { start: '2026-09-20' })).toBeNull()
    expect(validateReading(t('symptom'), { name: 'Headache', severity: 6 })).toBeNull()
    expect(validateReading(t('symptom'), { name: 'Headache', severity: 11 })).toMatch(/1–10/)
  })
  it('custom tracker validates schema without core changes', () => {
    const custom = t('custom', { fieldsSchema: [{ name: 'severity', label: 'Severity (1–10)', kind: 'severity10' as const }] })
    expect(validateReading(custom, { severity: 6 })).toBeNull()
    expect(validateReading(custom, { severity: 99 })).toMatch(/1–10/)
  })
})

describe('health helpers', () => {
  it('cycle day counts from latest start, no predictions', () => {
    const readings = [
      { id: 'a', trackerId: 'tracker_period', timestamp: 0, values: { start: '2026-09-01' } },
      { id: 'b', trackerId: 'tracker_period', timestamp: 0, values: { start: '2026-09-07' } },
    ]
    expect(cycleDay(readings, new Date(2026, 8, 20))).toBe(14)
    expect(cycleDay([], new Date())).toBeNull()
  })
  it('bmi + weight conversion', () => {
    expect(bmi(64.2, 165)).toBeCloseTo(23.6, 1)
    expect(fromKg(64.2, 'lb')).toBeCloseTo(141.5, 0)
  })
  it('chart data uses recorded points only, sorted, skips gaps', () => {
    const rows = [
      { id: 'b', trackerId: 'x', timestamp: 2000, values: { value: 70 } },
      { id: 'a', trackerId: 'x', timestamp: 1000, values: { value: 64 } },
      { id: 'c', trackerId: 'x', timestamp: 3000, values: { value: 'oops' } },
    ]
    const pts = toLinePoints(rows, (r) => {
      const n = Number(r.values.value)
      return Number.isFinite(n) ? n : null
    })
    expect(pts).toEqual([{ t: 1000, v: 64 }, { t: 2000, v: 70 }])
  })
})
