import { Suspense, lazy, useCallback, useState } from 'react'
import { AppShell } from './components/AppShell'
import { useSettings } from './db/settings'
import { useReminders } from './notifications/useReminders'
import { TodayScreen } from './screens/TodayScreen'
import type { TabId, TrackerKey } from './types'
import type { HealthAddSignal } from './screens/HealthScreen'

// Secondary tabs load on demand so first paint stays fast from local data.
const MedicinesScreen = lazy(() => import('./screens/MedicinesScreen').then((m) => ({ default: m.MedicinesScreen })))
const HealthScreen = lazy(() => import('./screens/HealthScreen').then((m) => ({ default: m.HealthScreen })))
const HistoryScreen = lazy(() => import('./screens/HistoryScreen').then((m) => ({ default: m.HistoryScreen })))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })))

function TabFallback() {
  return <p className="mr-muted py-8 text-center" role="status">Loading…</p>
}

export default function App() {
  const [tab, setTab] = useState<TabId>('today')
  const [addOpen, setAddOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const [addSignal, setAddSignal] = useState(0)
  const [healthSignal, setHealthSignal] = useState<HealthAddSignal>({ key: null, n: 0 })
  const [openMedId, setOpenMedId] = useState<string | null>(null)
  const settingsApi = useSettings()

  const bump = useCallback(() => setTick((t) => t + 1), [])
  const reminders = useReminders(settingsApi.settings, bump)

  const goAddMedication = useCallback(() => {
    setOpenMedId(null)
    setTab('medicines')
    setAddSignal((s) => s + 1)
  }, [])

  const goAddReading = useCallback((key: TrackerKey) => {
    setTab('health')
    setHealthSignal((s) => ({ key, n: s.n + 1 }))
  }, [])

  const openMed = useCallback((id: string) => {
    setOpenMedId(id)
    setTab('medicines')
  }, [])

  const openTracker = useCallback(() => {
    setTab('health')
  }, [])

  return (
    <AppShell
      tab={tab}
      onTab={setTab}
      addOpen={addOpen}
      onAdd={() => setAddOpen(true)}
      onAddClose={() => setAddOpen(false)}
      onAddMedication={goAddMedication}
      onAddReading={goAddReading}
      headerAction={
        tab !== 'settings' ? (
          <button
            type="button"
            aria-label="Open settings"
            onClick={() => setTab('settings')}
            className="grid h-11 w-11 place-items-center rounded-full border text-lg"
            style={{ borderColor: 'var(--mr-border)', background: 'var(--mr-surface)' }}
          >
            <span aria-hidden="true">⚙</span>
          </button>
        ) : undefined
      }
    >
      {tab === 'today' ? (
        <TodayScreen settings={settingsApi.settings} reminders={reminders} tick={tick} onAdd={goAddMedication} onOpenMed={openMed} onOpenHealth={openTracker} />
      ) : null}
      {tab !== 'today' ? (
        <Suspense fallback={<TabFallback />}>
          {tab === 'medicines' ? (
            <MedicinesScreen
              tick={tick}
              onChanged={bump}
              externalOpenId={openMedId}
              onClearExternal={() => setOpenMedId(null)}
              addSignal={addSignal}
            />
          ) : null}
          {tab === 'health' ? (
            <HealthScreen
              settings={settingsApi.settings}
              tick={tick}
              onChanged={bump}
              addSignal={healthSignal}
              onClearAddSignal={() => setHealthSignal((s) => ({ ...s, n: 0 }))}
            />
          ) : null}
          {tab === 'history' ? <HistoryScreen tick={tick} onChanged={bump} settings={settingsApi.settings} /> : null}
          {tab === 'settings' ? <SettingsScreen api={settingsApi} /> : null}
        </Suspense>
      ) : null}
    </AppShell>
  )
}
