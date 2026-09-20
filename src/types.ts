// mediRem core domain types — Phase 0 scaffold.
// Mirrors spec §58. Dose events & readings grow in Phase 1/2; keep defs separate from events.

export type MedicationStatus = 'active' | 'paused' | 'completed' | 'archived'

export type MedicationForm =
  | 'tablet' | 'capsule' | 'syrup' | 'liquid' | 'injection'
  | 'cream' | 'ointment' | 'drops' | 'inhaler' | 'other'

export interface Medication {
  id: string
  name: string
  genericName?: string
  brandName?: string
  strength?: string
  strengthUnit?: string
  form: MedicationForm
  customForm?: string
  doseAmount: number
  doseUnit: string
  qtyPerDose: number
  foodInstruction?: string
  foodInstructionCustom?: string
  doctorsInstructions?: string
  structuredInstructions?: string[]
  notes?: string
  status: MedicationStatus
  initialQty?: number
  currentQty?: number
  refillThresholdDays?: number
  refillThresholdDoses?: number
  createdAt: number
  updatedAt: number
}

export type ScheduleType = 'once_daily' | 'multi_daily' | 'weekly' | 'interval_hours' | 'sos'

export interface MedicationSchedule {
  id: string
  medicationId: string
  type: ScheduleType
  /** Local HH:mm strings, e.g. ["08:00","20:00"] */
  times: string[]
  daysOfWeek?: number[] // 0=Sun..6=Sat, for weekly
  intervalHours?: number // for interval_hours
  startDate: string // yyyy-MM-dd local
  endDate?: string
}

export type DoseStatus = 'upcoming' | 'due' | 'taken' | 'snoozed' | 'skipped' | 'missed'

export interface MedicationDoseEvent {
  id: string
  medicationId: string
  scheduleId: string
  scheduledAt: number
  status: DoseStatus
  takenAt?: number
  snoozedUntil?: number
  /** Guard against uncontrolled snooze loops (cap enforced in snoozeEvent). */
  snoozeCount?: number
  note?: string
}

export interface MedicationRefill {
  id: string
  medicationId: string
  prevQty: number
  addedQty: number
  newQty: number
  at: number
}

export type TrackerKey =
  | 'bp' | 'glucose' | 'weight' | 'hr' | 'spo2' | 'temp' | 'period' | 'symptom' | 'custom'

export interface CustomFieldDef {
  name: string
  label: string
  kind: 'number' | 'text' | 'severity10' | 'quality5' | 'time' | 'date'
  unit?: string
}

export interface HealthTracker {
  id: string
  key: TrackerKey
  name: string
  unit?: string
  /** Only for custom trackers: user-defined schema. Built-ins use fixed forms. */
  fieldsSchema?: CustomFieldDef[]
  active: boolean
  createdAt: number
}

export interface HealthReading {
  id: string
  trackerId: string
  timestamp: number
  values: Record<string, number | string>
  context?: string
  notes?: string
}

export type ThemePref = 'system' | 'light' | 'dark'

export interface AppSettings {
  medicationReminders: boolean
  reminderLeadMinutes: 1 | 3 | 5 | 10 | 15
  sound: boolean
  vibration: boolean
  refillReminders: boolean
  snoozeMinutes: 5 | 10 | 15
  missedGraceMinutes: number
  theme: ThemePref
  weightUnit: 'kg' | 'lb'
  tempUnit: 'C' | 'F'
  glucoseUnit: 'mg/dL' | 'mmol/L'
}

export type TabId = 'today' | 'medicines' | 'health' | 'history' | 'settings'
