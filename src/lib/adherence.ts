import type { MedicationDoseEvent } from '../types'

export interface AdherenceSummary {
  recorded: number // taken
  scheduled: number // taken + skipped + missed
  percent: number | null
  /** Neutral, non-shaming copy. */
  label: string // e.g. "18 / 21 doses recorded"
}

/** Neutral adherence: taken / (taken+skipped+missed). Snoozed/upcoming excluded. */
export function adherence(events: Pick<MedicationDoseEvent, 'status'>[]): AdherenceSummary {
  let recorded = 0
  let scheduled = 0
  for (const e of events) {
    if (e.status === 'taken') {
      recorded += 1
      scheduled += 1
    } else if (e.status === 'skipped' || e.status === 'missed') {
      scheduled += 1
    }
  }
  if (scheduled === 0) return { recorded, scheduled, percent: null, label: 'No scheduled doses yet.' }
  const percent = Math.round((recorded / scheduled) * 100)
  return { recorded, scheduled, percent, label: `${recorded} / ${scheduled} doses recorded` }
}
