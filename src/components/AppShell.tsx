import type { ReactNode } from 'react'
import type { TabId, TrackerKey } from '../types'
import { BottomNavigation } from './BottomNavigation'
import { QuickAddSheet } from './QuickAddSheet'

export function AppShell({
  tab,
  onTab,
  addOpen,
  onAdd,
  onAddClose,
  onAddMedication,
  onAddReading,
  children,
  headerAction,
}: {
  tab: TabId
  onTab: (t: TabId) => void
  addOpen: boolean
  onAdd: () => void
  onAddClose: () => void
  onAddMedication: () => void
  onAddReading: (key: TrackerKey) => void
  children: ReactNode
  headerAction?: ReactNode
}) {
  return (
    <div className="min-h-dvh" style={{ background: 'var(--mr-bg)' }}>
      <a href="#main-content" className="mr-skip">Skip to content</a>
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" width={32} height={32} className="rounded-lg" />
          <div>
            <p className="text-[17px] font-bold leading-none">mediRem</p>
            <p className="mr-muted text-xs">Your medication, on time.</p>
          </div>
        </div>
        {headerAction}
      </header>
      <main id="main-content" className="mx-auto max-w-xl px-5 pb-32 pt-4">{children}</main>
      <QuickAddSheet open={addOpen} onClose={onAddClose} onAddMedication={onAddMedication} onAddReading={onAddReading} />
      <BottomNavigation tab={tab} onChange={onTab} onAdd={onAdd} />
    </div>
  )
}
