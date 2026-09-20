import type { TabId } from '../types'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '◐' },
  { id: 'medicines', label: 'Medicines', icon: '⬢' },
  { id: 'health', label: 'Health', icon: '♡' },
  { id: 'history', label: 'History', icon: '◷' },
]

export function BottomNavigation({
  tab,
  onChange,
  onAdd,
}: {
  tab: TabId
  onChange: (t: TabId) => void
  onAdd: () => void
}) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t"
      style={{ background: 'var(--mr-surface)', borderColor: 'var(--mr-border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto grid max-w-xl grid-cols-5 items-end px-2 pt-1">
        {TABS.slice(0, 2).map((t) => (
          <NavBtn key={t.id} active={tab === t.id} label={t.label} icon={t.icon} onClick={() => onChange(t.id)} />
        ))}
        <div className="flex justify-center pb-1">
          <button type="button" className="mr-fab" aria-label="Add medication or health entry" onClick={onAdd}>
            <span aria-hidden="true">+</span>
          </button>
        </div>
        {TABS.slice(2).map((t) => (
          <NavBtn key={t.id} active={tab === t.id} label={t.label} icon={t.icon} onClick={() => onChange(t.id)} />
        ))}
      </div>
    </nav>
  )
}

function NavBtn({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium"
      style={{ color: active ? 'var(--mr-primary-deep)' : 'var(--mr-muted)' }}
    >
      <span aria-hidden="true" style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </button>
  )
}
