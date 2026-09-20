import { useState } from 'react'
import { AppShell } from './components/AppShell'
import { useSettings } from './db/settings'
import { HealthScreen } from './screens/HealthScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { MedicinesScreen } from './screens/MedicinesScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TodayScreen } from './screens/TodayScreen'
import type { TabId } from './types'

export default function App() {
  const [tab, setTab] = useState<TabId>('today')
  const [addOpen, setAddOpen] = useState(false)
  const settingsApi = useSettings()

  return (
    <AppShell
      tab={tab}
      onTab={setTab}
      addOpen={addOpen}
      onAdd={() => setAddOpen(true)}
      onAddClose={() => setAddOpen(false)}
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
      {tab === 'today' ? <TodayScreen onAdd={() => setAddOpen(true)} /> : null}
      {tab === 'medicines' ? <MedicinesScreen onAdd={() => setAddOpen(true)} /> : null}
      {tab === 'health' ? <HealthScreen /> : null}
      {tab === 'history' ? <HistoryScreen /> : null}
      {tab === 'settings' ? <SettingsScreen api={settingsApi} /> : null}
    </AppShell>
  )
}
