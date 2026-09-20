import { useCallback, useState } from 'react'
import { AppShell } from './components/AppShell'
import { useSettings } from './db/settings'
import { useReminders } from './notifications/useReminders'
import { HealthScreen } from './screens/HealthScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { MedicinesScreen } from './screens/MedicinesScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TodayScreen } from './screens/TodayScreen'
import type { TabId } from './types'

export default function App() {
  const [tab, setTab] = useState<TabId>('today')
  const [addOpen, setAddOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const [addSignal, setAddSignal] = useState(0)
  const [openMedId, setOpenMedId] = useState<string | null>(null)
  const settingsApi = useSettings()

  const bump = useCallback(() => setTick((t) => t + 1), [])
  const reminders = useReminders(settingsApi.settings, bump)

  const goAddMedication = useCallback(() => {
    setOpenMedId(null)
    setTab('medicines')
    setAddSignal((s) => s + 1)
  }, [])

  const openMed = useCallback((id: string) => {
    setOpenMedId(id)
    setTab('medicines')
  }, [])

  return (
    <AppShell
      tab={tab}
      onTab={setTab}
      addOpen={addOpen}
      onAdd={() => setAddOpen(true)}
      onAddClose={() => setAddOpen(false)}
      onAddMedication={goAddMedication}
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
        <TodayScreen settings={settingsApi.settings} reminders={reminders} tick={tick} onAdd={goAddMedication} onOpenMed={openMed} />
      ) : null}
      {tab === 'medicines' ? (
        <MedicinesScreen
          tick={tick}
          onChanged={bump}
          externalOpenId={openMedId}
          onClearExternal={() => setOpenMedId(null)}
          addSignal={addSignal}
        />
      ) : null}
      {tab === 'health' ? <HealthScreen /> : null}
      {tab === 'history' ? <HistoryScreen tick={tick} onChanged={bump} /> : null}
      {tab === 'settings' ? <SettingsScreen api={settingsApi} /> : null}
    </AppShell>
  )
}
