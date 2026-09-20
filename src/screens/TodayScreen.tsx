import { useEffect, useState } from 'react'
import { useToast } from '../components/Dialogs'
import { EmptyState } from '../components/EmptyState'
import {
  ensureEvent,
  listAllSchedules,
  markSkipped,
  markTaken,
  recordSosIntake,
  snoozeEvent,
  todayTimeline,
} from '../db/medications'
import { db } from '../db/database'
import { adherence } from '../lib/adherence'
import { formatCountdown, formatLongDateShim, formatTimeLabel, greetingFor } from '../lib/today-utils'
import { daysRemaining, refillState } from '../lib/inventory'
import { nextOccurrence } from '../lib/schedule'
import { formatReadingSummary, recentReadings } from '../db/health'
import type { AppSettings, Medication } from '../types'
import { ReminderCenter } from '../notifications/ReminderCenter'
import type { useReminders } from '../notifications/useReminders'
import { requestPermission } from '../notifications/sound'

type RemindersApi = ReturnType<typeof useReminders>

export function TodayScreen({
  settings,
  reminders,
  tick,
  onAdd,
  onOpenMed,
  onOpenHealth,
}: {
  settings: AppSettings
  reminders: RemindersApi
  tick: number
  onAdd: () => void
  onOpenMed: (id: string) => void
  onOpenHealth: () => void
}) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof todayTimeline>>>([])
  const [next, setNext] = useState<{ med: Medication; at: number } | null>(null)
  const [attention, setAttention] = useState<{ med: Medication; reason: string }[]>([])
  const [sos, setSos] = useState<{ med: Medication; scheduleId: string }[]>([])
  const [weekLabel, setWeekLabel] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    let alive = true
    ;(async () => {
      const tl = await todayTimeline(new Date())
      // Ensure events exist for each occurrence
      for (const r of tl) {
        if (!r.event) {
          const e = await ensureEvent(r.medicationId, r.scheduleId, r.at)
          r.event = e
        }
      }
      if (!alive) return
      setRows(tl)

      const meds = await db.medications.toArray()
      const byId = new Map(meds.map((m) => [m.id, m]))
      const schedules = await listAllSchedules()
      const occ = nextOccurrence(Date.now(), schedules, byId)
      setNext(occ ? { med: byId.get(occ.medicationId)!, at: occ.at } : null)

      const att: { med: Medication; reason: string }[] = []
      for (const m of meds.filter((x) => x.status === 'active')) {
        const sch = schedules.filter((s) => s.medicationId === m.id)
        if (sch.length === 0) continue
        const st = refillState(m, sch)
        if (st.due && st.reason) att.push({ med: m, reason: st.reason })
      }
      const missed = await db.doseEvents.where('status').equals('missed').toArray()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const missedToday = missed.filter((e) => e.scheduledAt >= todayStart.getTime())
      for (const e of missedToday.slice(0, 5)) {
        const m = byId.get(e.medicationId)
        if (m) att.push({ med: m, reason: `Missed ${formatTimeLabel(e.scheduledAt)} dose — no pressure, just information.` })
      }
      setAttention(att.slice(0, 8))

      setSos(
        schedules
          .filter((s) => s.type === 'sos' && byId.get(s.medicationId)?.status === 'active')
          .map((s) => ({ med: byId.get(s.medicationId)!, scheduleId: s.id })),
      )

      const week = await db.doseEvents.toArray()
      const s = adherence(week.filter((e) => e.scheduledAt > Date.now() - 7 * 86400000))
      setWeekLabel(s.label)
    })()
    return () => {
      alive = false
    }
  }, [tick])

  const now = new Date()
  const done = rows.filter((r) => r.event && (r.event.status === 'taken' || r.event.status === 'skipped'))
  const upcoming = rows.filter((r) => !r.event || !['taken', 'skipped', 'missed'].includes(r.event.status))

  const act = async (key: string, fn: () => Promise<void>) => {
    setActing(key)
    try {
      await fn()
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mr-h1">{greetingFor(now)}</h1>
        <p className="mr-muted mr-body">{formatLongDateShim(now)} · {weekLabel}</p>
      </div>

      <section aria-labelledby="today-next" className="mr-card p-5">
        <h2 id="today-next" className="mr-h2">Next</h2>
        {next ? (
          <button type="button" onClick={() => onOpenMed(next.med.id)} className="mt-2 w-full text-left">
            <p className="text-xl font-bold">{next.med.name}</p>
            <p className="mr-muted">{formatTimeLabel(next.at)} · {next.med.doseAmount} {next.med.doseUnit}{next.med.foodInstruction && next.med.foodInstruction !== 'Any time' ? ` · ${next.med.foodInstruction}` : ''}</p>
            <p className="mt-1 font-semibold" style={{ color: 'var(--mr-primary-deep)' }}>{formatCountdown(Date.now(), next.at)}</p>
          </button>
        ) : (
          <p className="mr-muted mr-body mt-1">Nothing scheduled. {rows.length === 0 ? 'Add your first medication to see it here.' : 'All caught up for now.'}</p>
        )}
      </section>

      <section aria-labelledby="today-timeline" className="mr-card p-5">
        <h2 id="today-timeline" className="mr-h2">Today</h2>
        {rows.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No medications yet"
              body="Add your first medication to start building your schedule. Your data stays on this device."
              action={<button type="button" onClick={onAdd} className="mr-btn-primary px-5 py-3">+ Add medication</button>}
            />
          </div>
        ) : (
          <ol className="mt-3 space-y-3">
            {rows.map((r) => {
              const st = r.event?.status ?? 'upcoming'
              const icon = st === 'taken' ? '✓' : st === 'skipped' ? '–' : st === 'missed' ? '○' : '○'
              const label = st === 'taken' && r.event?.takenAt ? `Taken at ${formatTimeLabel(r.event.takenAt)}` : st === 'skipped' ? 'Skipped' : st === 'missed' ? 'Missed' : st === 'snoozed' ? 'Snoozed' : 'Upcoming'
              const key = `${r.medicationId}|${r.scheduleId}|${r.at}`
              return (
                <li key={key} className="flex items-start gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--mr-border)' }}>
                  <span aria-hidden="true" className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border font-bold" style={{ borderColor: 'var(--mr-border)' }}>{icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{formatTimeLabel(r.at)} — {r.med.name}</p>
                    <p className="mr-muted text-sm">{r.med.doseAmount} {r.med.doseUnit}{r.med.foodInstruction && r.med.foodInstruction !== 'Any time' ? ` · ${r.med.foodInstruction}` : ''} · {label}</p>
                    {(!r.event || ['upcoming', 'due', 'snoozed'].includes(r.event.status)) ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" disabled={acting === key} onClick={() => void act(key, async () => { const e = r.event ?? (await ensureEvent(r.medicationId, r.scheduleId, r.at)); await markTaken(e.id) })} className="mr-btn-primary px-4 py-1.5 text-sm">
                          ✓ Taken
                        </button>
                        <button type="button" onClick={() => void act(key, async () => { const e = r.event ?? (await ensureEvent(r.medicationId, r.scheduleId, r.at)); const ok = await snoozeEvent(e.id, settings.snoozeMinutes); if (!ok) toast.show('Snooze limit reached for this dose — please record it.') })} className="rounded-full border px-3.5 py-1.5 text-sm font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
                          Snooze
                        </button>
                        <button type="button" onClick={() => void act(key, async () => { const e = r.event ?? (await ensureEvent(r.medicationId, r.scheduleId, r.at)); await markSkipped(e.id) })} className="rounded-full border px-3.5 py-1.5 text-sm font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
                          Skip
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        {rows.length > 0 ? (
          <p className="mr-muted mt-3 text-sm">{done.length} of {rows.length} recorded today.</p>
        ) : null}
        {upcoming.length === 0 && rows.length > 0 ? <p className="mt-2 font-medium">All caught up for today.</p> : null}
      </section>

      {sos.length > 0 ? (
        <section aria-labelledby="today-sos" className="mr-card p-5">
          <h2 id="today-sos" className="mr-h2">As needed</h2>
          <ul className="mt-2 space-y-2">
            {sos.map(({ med, scheduleId }) => (
              <li key={med.id} className="flex items-center justify-between gap-3">
                <span className="font-medium">{med.name} · {med.doseAmount} {med.doseUnit}</span>
                <button type="button" onClick={() => void recordSosIntake(med.id, scheduleId)} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
                  Record taken
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="today-health" className="mr-card p-5">
        <div className="flex items-center justify-between">
          <h2 id="today-health" className="mr-h2">Health</h2>
          <button type="button" onClick={onOpenHealth} className="rounded-full border px-3.5 py-1.5 text-sm font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
            Open
          </button>
        </div>
        <HealthSnippet tick={tick} settings={settings} />
      </section>

      <section aria-labelledby="today-attention" className="mr-card p-5">
        <h2 id="today-attention" className="mr-h2">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mr-muted mr-body mt-1">Nothing needs attention right now.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {attention.map((a, i) => (
              <li key={`${a.med.id}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--mr-border)' }}>
                <div>
                  <p className="font-bold">{a.med.name}</p>
                  <p className="mr-muted text-sm">{a.reason}</p>
                </div>
                <button type="button" onClick={() => onOpenMed(a.med.id)} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
        <RefillHint />
      </section>

      <ReminderCenter
        items={reminders.center}
        scheduling={reminders.scheduling}
        permission={reminders.permission}
        onTaken={(i) => void reminders.actTaken(i)}
        onSnooze={(i) => void reminders.actSnooze(i).then((ok) => {
          if (!ok) toast.show('Snooze limit reached for this dose — please record it.')
        })}
        onSkip={(i) => void reminders.actSkip(i)}
        onDismiss={(k) => reminders.dismiss(k)}
        onEnable={() => void requestPermission().then((p) => reminders.setPermission(p))}
      />
      {toast.node}
    </div>
  )
}

function HealthSnippet({ tick, settings }: { tick: number; settings: AppSettings }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof recentReadings>>>([])
  useEffect(() => {
    let alive = true
    recentReadings(3).then((r) => {
      if (alive) setItems(r)
    })
    return () => {
      alive = false
    }
  }, [tick])
  if (items.length === 0) return <p className="mr-muted mr-body mt-1">No health readings yet.</p>
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map(({ tracker, reading }) => (
        <li key={reading.id} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold">{tracker.name}</span>
          <span className="mr-muted text-right">{formatReadingSummary(tracker, reading, settings)}</span>
        </li>
      ))}
    </ul>
  )
}

function RefillHint() {
  const [hints, setHints] = useState<string[]>([])
  useEffect(() => {
    ;(async () => {
      const meds = await db.medications.toArray()
      const schedules = await listAllSchedules()
      const out: string[] = []
      for (const m of meds.filter((x) => x.status === 'active' && x.currentQty != null)) {
        const sch = schedules.filter((s) => s.medicationId === m.id)
        if (sch.length === 0) continue
        const d = daysRemaining(m, sch)
        if (d != null && d <= 14) out.push(`${m.name}: approximately ${d} days remaining`)
      }
      setHints(out.slice(0, 5))
    })()
  }, [])
  if (hints.length === 0) return null
  return (
    <ul className="mr-muted mt-2 space-y-1 text-sm">
      {hints.map((h) => <li key={h}>{h}</li>)}
    </ul>
  )
}
