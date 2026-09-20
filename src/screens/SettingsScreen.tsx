import { useState } from 'react'
import { clearAllLocalData } from '../db/database'
import { DEFAULT_SETTINGS, type useSettings } from '../db/settings'

type SettingsApi = ReturnType<typeof useSettings>

export function SettingsScreen({ api }: { api: SettingsApi }) {
  const { settings, update, ready } = api
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [cleared, setCleared] = useState(false)

  if (!ready) return <p className="mr-muted">Loading settings…</p>

  return (
    <div className="space-y-4">
      <h1 className="mr-h1">Settings</h1>

      <section className="mr-card space-y-4 p-5" aria-labelledby="s-notif">
        <h2 id="s-notif" className="mr-h2">Notifications</h2>
        <Toggle label="Medication reminders" checked={settings.medicationReminders} onChange={(v) => void update({ medicationReminders: v })} />
        <Toggle label="Reminder sound (mediRem chime)" checked={settings.sound} onChange={(v) => void update({ sound: v })} />
        <Toggle label="Vibration" checked={settings.vibration} onChange={(v) => void update({ vibration: v })} />
        <Toggle label="Refill reminders" checked={settings.refillReminders} onChange={(v) => void update({ refillReminders: v })} />
        <Row label="Reminder lead time">
          <Seg
            options={[1, 3, 5, 10, 15]}
            value={settings.reminderLeadMinutes}
            format={(v) => `${v}m`}
            onPick={(v) => void update({ reminderLeadMinutes: v as 1 | 3 | 5 | 10 | 15 })}
          />
        </Row>
        <Row label="Snooze duration">
          <Seg
            options={[5, 10, 15]}
            value={settings.snoozeMinutes}
            format={(v) => `${v}m`}
            onPick={(v) => void update({ snoozeMinutes: v as 5 | 10 | 15 })}
          />
        </Row>
      </section>

      <section className="mr-card space-y-4 p-5" aria-labelledby="s-appear">
        <h2 id="s-appear" className="mr-h2">Appearance</h2>
        <Row label="Theme">
          <Seg
            options={['system', 'light', 'dark']}
            value={settings.theme}
            format={(v) => v[0].toUpperCase() + v.slice(1)}
            onPick={(v) => void update({ theme: v as typeof settings.theme })}
          />
        </Row>
      </section>

      <section className="mr-card space-y-4 p-5" aria-labelledby="s-units">
        <h2 id="s-units" className="mr-h2">Units</h2>
        <Row label="Weight">
          <Seg options={['kg', 'lb']} value={settings.weightUnit} format={(v) => v} onPick={(v) => void update({ weightUnit: v as 'kg' | 'lb' })} />
        </Row>
        <Row label="Temperature">
          <Seg options={['C', 'F']} value={settings.tempUnit} format={(v) => `°${v}`} onPick={(v) => void update({ tempUnit: v as 'C' | 'F' })} />
        </Row>
        <Row label="Glucose">
          <Seg
            options={['mg/dL', 'mmol/L']}
            value={settings.glucoseUnit}
            format={(v) => v}
            onPick={(v) => void update({ glucoseUnit: v as 'mg/dL' | 'mmol/L' })}
          />
        </Row>
      </section>

      <section className="mr-card space-y-3 p-5" aria-labelledby="s-data">
        <h2 id="s-data" className="mr-h2">Data</h2>
        <p className="mr-muted mr-body">Everything stays on this device. Export is local-only; nothing is uploaded.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-full border px-4 py-2.5 font-semibold" style={{ borderColor: 'var(--mr-border)' }} onClick={() => void exportJson()}>
            Export JSON
          </button>
          <button
            type="button"
            className="rounded-full border px-4 py-2.5 font-semibold"
            style={{ borderColor: 'var(--mr-border)' }}
            onClick={() => void update({ ...DEFAULT_SETTINGS, theme: settings.theme })}
          >
            Reset settings
          </button>
        </div>
        {!confirmingClear ? (
          <button type="button" className="font-semibold text-red-800 underline dark:text-red-300" onClick={() => setConfirmingClear(true)}>
            Clear local data…
          </button>
        ) : (
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--mr-border)' }}>
            <p className="font-semibold">Delete all local medications and health data?</p>
            <p className="mr-muted mr-body mt-1">This cannot be undone. Export first if you want a copy.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="rounded-full border px-4 py-2" style={{ borderColor: 'var(--mr-border)' }} onClick={() => setConfirmingClear(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-red-800 px-4 py-2 font-semibold text-white"
                onClick={() => void clearAllLocalData().then(() => { setCleared(true); setConfirmingClear(false) })}
              >
                Delete everything
              </button>
            </div>
          </div>
        )}
        {cleared ? <p role="status" className="font-medium">Local data cleared.</p> : null}
      </section>
    </div>
  )
}

async function exportJson() {
  const { db } = await import('../db/database')
  const data = {
    exportedAt: new Date().toISOString(),
    medications: await db.medications.toArray(),
    schedules: await db.schedules.toArray(),
    doseEvents: await db.doseEvents.toArray(),
    refills: await db.refills.toArray(),
    trackers: await db.trackers.toArray(),
    readings: await db.readings.toArray(),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `medirem-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3">
      <span className="font-medium">{label}</span>
      <input type="checkbox" className="h-6 w-6 accent-[#5C7A66]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="font-medium">{label}</span>
      {children}
    </div>
  )
}

function Seg<T extends string | number>({ options, value, format, onPick }: { options: readonly T[]; value: T; format: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <div role="group" aria-label="options" className="flex gap-1 rounded-full border p-1" style={{ borderColor: 'var(--mr-border)' }}>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          aria-pressed={o === value}
          onClick={() => onPick(o)}
          className="rounded-full px-3 py-1.5 text-sm font-semibold"
          style={o === value ? { background: 'var(--mr-primary-deep)', color: '#fff' } : { color: 'var(--mr-muted)' }}
        >
          {format(o)}
        </button>
      ))}
    </div>
  )
}
