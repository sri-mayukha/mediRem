import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyMissedSweep,
  ensureEvent,
  listAllSchedules,
  markSkipped,
  markTaken,
  snoozeEvent,
} from '../db/medications'
import { db } from '../db/database'
import { refillState } from '../lib/inventory'
import { nextOccurrence, occurrencesForDay } from '../lib/schedule'
import { formatCountdown, formatTimeLabel } from '../lib/time'
import type { AppSettings, Medication } from '../types'
import { permissionState, playMediRemChime, systemNotify, vibrateMediRem } from './sound'

export interface CenterItem {
  key: string
  kind: 'pre' | 'due' | 'refill'
  title: string
  body: string
  at: number
  medicationId?: string
  eventId?: string
  medName?: string
}

export function useReminders(settings: AppSettings, onChanged: () => void) {
  const [center, setCenter] = useState<CenterItem[]>([])
  const [permission, setPermission] = useState(permissionState())
  const [scheduling, setScheduling] = useState<'ok' | 'in-app-only'>('in-app-only')
  const notifiedRef = useRef<Set<string>>(new Set())

  const push = useCallback((item: CenterItem) => {
    setCenter((cur) => (cur.some((c) => c.key === item.key) ? cur : [item, ...cur].slice(0, 20)))
  }, [])

  const tick = useCallback(async () => {
    try {
      const now = Date.now()
      await applyMissedSweep(now, settings.missedGraceMinutes)
      const meds = await db.medications.toArray()
      const byId = new Map(meds.map((m) => [m.id, m]))
      const schedules = await listAllSchedules()

      // Missed-dose catch-up on app open: surface doses that lapsed while away.
      // Neutral copy, pushed once (tracked in kv), so reopening never spams.
      try {
        const lastRow = await db.kv.get('reminders-catchup')
        const last = typeof lastRow?.value === 'number' ? (lastRow.value as number) : now - 24 * 3600000
        const newlyMissed = await db.doseEvents.where('status').equals('missed').toArray()
        const fresh = newlyMissed
          .filter((e) => e.scheduledAt > last && e.scheduledAt > now - 7 * 86400000)
          .sort((a, b) => b.scheduledAt - a.scheduledAt)
          .slice(0, 5)
        for (const e of fresh) {
          const m = byId.get(e.medicationId)
          if (!m) continue
          const key = `missed:${e.id}`
          if (notifiedRef.current.has(key)) continue
          notifiedRef.current.add(key)
          push({
            key, kind: 'due', title: 'mediRem · Missed dose',
            body: `${m.name} · ${formatTimeLabel(e.scheduledAt)}\nNo pressure — you can still record it below.`,
            at: e.scheduledAt, medicationId: e.medicationId, eventId: e.id, medName: m.name,
          })
        }
        await db.kv.put({ key: 'reminders-catchup', value: now })
      } catch {
        // Catch-up is best-effort; scheduling continues.
      }

      // Re-alert when a snoozed dose comes due again (capped by snoozeCount in snoozeEvent).
      try {
        const snoozed = await db.doseEvents.where('status').equals('snoozed').toArray()
        for (const e of snoozed) {
          if (!e.snoozedUntil || now < e.snoozedUntil || now >= e.snoozedUntil + 60000) continue
          const key = `snooze:${e.id}:${e.snoozedUntil}`
          if (notifiedRef.current.has(key)) continue
          notifiedRef.current.add(key)
          const m = byId.get(e.medicationId)
          if (!m) continue
          const title = 'mediRem · Snoozed reminder'
          const body = `${m.name}\n${m.doseAmount} ${m.doseUnit}\n${formatTimeLabel(e.scheduledAt)}`
          const shown = await systemNotify(title, body, key)
          setScheduling(shown === 'system' ? 'ok' : 'in-app-only')
          push({ key, kind: 'due', title, body, at: now, medicationId: e.medicationId, eventId: e.id, medName: m.name })
          if (shown === 'system') {
            playMediRemChime(settings.sound)
            vibrateMediRem(settings.vibration)
          }
        }
      } catch {
        // Snooze re-alert is best-effort.
      }

      // Ensure today's + tomorrow's events exist in DB
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      for (const day of [today, tomorrow]) {
        const occs = occurrencesForDay(day, schedules, byId)
        for (const o of occs) await ensureEvent(o.medicationId, o.scheduleId, o.at)
      }

      if (!settings.medicationReminders) {
        onChanged()
        return
      }

      // Pre (lead time) + due triggers
      for (const day of [today, tomorrow]) {
        const occs = occurrencesForDay(day, schedules, byId)
        for (const o of occs) {
          const med = byId.get(o.medicationId)
          if (!med) continue
          const evt = await db.doseEvents.get(`evt_${o.medicationId}_${o.scheduleId}_${o.at}`)
          if (evt && (evt.status === 'taken' || evt.status === 'skipped' || evt.status === 'missed')) continue

          const preAt = o.at - settings.reminderLeadMinutes * 60000
          const preKey = `pre:${o.medicationId}:${o.scheduleId}:${o.at}`
          if (now >= preAt && now < o.at && !notifiedRef.current.has(preKey)) {
            notifiedRef.current.add(preKey)
            await fireDose(med, o.at, 'pre', settings, push)
          }
          const dueKey = `due:${o.medicationId}:${o.scheduleId}:${o.at}`
          if (now >= o.at && now < o.at + 60000 && !notifiedRef.current.has(dueKey)) {
            notifiedRef.current.add(dueKey)
            await fireDose(med, o.at, 'due', settings, push)
          }
        }
      }

      // Refill sweep (once per med per session)
      if (settings.refillReminders) {
        for (const m of meds.filter((x) => x.status === 'active')) {
          const sch = schedules.filter((s) => s.medicationId === m.id)
          if (sch.length === 0) continue
          const st = refillState(m, sch)
          const key = `refill:${m.id}`
          if (st.due && !notifiedRef.current.has(key)) {
            notifiedRef.current.add(key)
            const title = 'mediRem'
            const body = `${m.name} is running low. ${st.reason ?? ''} Refill soon.`.trim()
            const shown = await systemNotify(title, body, key)
            setScheduling(shown === 'system' ? 'ok' : 'in-app-only')
            push({ key, kind: 'refill', title, body, at: Date.now(), medicationId: m.id, medName: m.name })
            if (shown === 'system') {
              playMediRemChime(settings.sound)
              vibrateMediRem(settings.vibration)
            }
          }
        }
      }
      onChanged()
    } catch {
      // Never break the app for reminder errors; in-app center remains source of truth.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.medicationReminders, settings.reminderLeadMinutes, settings.missedGraceMinutes, settings.refillReminders, settings.sound, settings.vibration])

  useEffect(() => {
    setPermission(permissionState())
    void tick()
    const id = window.setInterval(() => void tick(), 30000)
    return () => window.clearInterval(id)
  }, [tick])

  const actTaken = async (item: CenterItem) => {
    if (item.eventId) await markTaken(item.eventId)
    setCenter((cur) => cur.filter((c) => c.key !== item.key))
    onChanged()
  }
  const actSkip = async (item: CenterItem) => {
    if (item.eventId) await markSkipped(item.eventId)
    setCenter((cur) => cur.filter((c) => c.key !== item.key))
    onChanged()
  }
  const actSnooze = async (item: CenterItem): Promise<boolean> => {
    if (!item.eventId) {
      dismiss(item.key)
      return true
    }
    const ok = await snoozeEvent(item.eventId, settings.snoozeMinutes)
    setCenter((cur) => cur.filter((c) => c.key !== item.key))
    onChanged()
    return ok
  }
  const dismiss = (key: string) => setCenter((cur) => cur.filter((c) => c.key !== key))

  return { center, push, permission, setPermission, scheduling, actTaken, actSkip, actSnooze, dismiss, tick }
}

async function fireDose(
  med: Medication,
  at: number,
  kind: 'pre' | 'due',
  settings: AppSettings,
  push: (i: CenterItem) => void,
) {
  const dose = `${med.doseAmount} ${med.doseUnit}`
  const food = med.foodInstruction && med.foodInstruction !== 'Any time' ? `\n${med.foodInstruction}` : ''
  const strength = [med.strength, med.strengthUnit].filter(Boolean).join(' ')
  const title = kind === 'pre' ? `mediRem · Medicine in ${settings.reminderLeadMinutes} minutes` : 'mediRem · Medication due'
  const body = `${med.name}\n${[strength, dose].filter(Boolean).join(' · ')}${food}\n${formatTimeLabel(at)}`
  const key = `${kind}:${med.id}:${at}`
  // Ensure event exists so actions can resolve
  const schedules = await listAllSchedules()
  const byId = new Map([[med.id, med]])
  void byId
  const occ = nextOccurrence(at - 1, schedules.filter((s) => s.medicationId === med.id), new Map([[med.id, med]]))
  void occ
  const eventId = await resolveEventId(med.id, at)
  const shown = await systemNotify(title, body, key)
  push({ key, kind, title, body, at, medicationId: med.id, eventId: eventId ?? undefined, medName: med.name })
  if (shown === 'system') {
    playMediRemChime(settings.sound)
    vibrateMediRem(settings.vibration)
  }
}

async function resolveEventId(medicationId: string, at: number): Promise<string | null> {
  // Find the event whose scheduledAt matches (tolerate ms by exact match from ensureEvent)
  const rows = await db.doseEvents.where('medicationId').equals(medicationId).toArray()
  const hit = rows.find((r) => Math.abs(r.scheduledAt - at) < 1000)
  if (hit) return hit.id
  // Fallback: find schedule occurrence to build id
  const schedules = await listAllSchedules()
  const sch = schedules.find((s) => s.medicationId === medicationId)
  if (!sch) return null
  const evt = await ensureEvent(medicationId, sch.id, at)
  return evt.id
}

export function countdownLabel(at: number, now = Date.now()): string {
  return formatCountdown(now, at)
}
