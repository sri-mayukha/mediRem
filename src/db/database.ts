import Dexie, { type Table } from 'dexie'
import type {
  HealthReading,
  HealthTracker,
  Medication,
  MedicationDoseEvent,
  MedicationRefill,
  MedicationSchedule,
} from '../types'

/**
 * Local-only IndexedDB via Dexie — spec §4/5.
 * No server, no analytics. Health data never leaves the device.
 */
export class MediRemDb extends Dexie {
  medications!: Table<Medication, string>
  schedules!: Table<MedicationSchedule, string>
  doseEvents!: Table<MedicationDoseEvent, string>
  refills!: Table<MedicationRefill, string>
  trackers!: Table<HealthTracker, string>
  readings!: Table<HealthReading, string>
  kv!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('mediRem-db')
    this.version(1).stores({
      medications: 'id, status, name, updatedAt',
      schedules: 'id, medicationId',
      doseEvents: 'id, medicationId, scheduleId, scheduledAt, status',
      refills: 'id, medicationId, at',
      trackers: 'id, key, active',
      readings: 'id, trackerId, timestamp',
      kv: 'key',
    })
  }
}

export const db = new MediRemDb()

export async function clearAllLocalData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.medications, db.schedules, db.doseEvents, db.refills, db.trackers, db.readings, db.kv],
    async () => {
      await Promise.all([
        db.medications.clear(),
        db.schedules.clear(),
        db.doseEvents.clear(),
        db.refills.clear(),
        db.trackers.clear(),
        db.readings.clear(),
        db.kv.clear(),
      ])
    },
  )
}
