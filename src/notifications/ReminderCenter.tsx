import type { CenterItem } from './useReminders'

/** In-app Reminder Center — mandatory fallback per spec §60. Never claims system scheduling. */
export function ReminderCenter({
  items,
  scheduling,
  permission,
  onTaken,
  onSnooze,
  onSkip,
  onDismiss,
  onEnable,
}: {
  items: CenterItem[]
  scheduling: 'ok' | 'in-app-only'
  permission: NotificationPermission | 'unsupported'
  onTaken: (i: CenterItem) => void
  onSnooze: (i: CenterItem) => void
  onSkip: (i: CenterItem) => void
  onDismiss: (key: string) => void
  onEnable: () => void
}) {
  return (
    <section className="mr-card p-5" aria-labelledby="rem-center">
      <div className="flex items-center justify-between gap-3">
        <h2 id="rem-center" className="mr-h2">Reminders</h2>
        <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: 'var(--mr-border)', color: 'var(--mr-muted)' }}>
          {scheduling === 'ok' ? 'System + in-app' : 'In-app'}
        </span>
      </div>
      {permission === 'denied' ? (
        <p className="mr-muted mr-body mt-2">
          Notifications are currently disabled. Enable notifications in your browser or device settings to receive medication reminders. In-app reminders still work.
        </p>
      ) : permission === 'default' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="mr-muted mr-body">Enable system notifications for reminders outside the app.</p>
          <button type="button" onClick={onEnable} className="rounded-full border px-4 py-2 font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
            Enable notifications
          </button>
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="mr-muted mr-body mt-2">No active reminders. Upcoming doses will appear here even if system notifications are unavailable.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((i) => (
            <li key={i.key} className="rounded-2xl border p-3.5" style={{ borderColor: 'var(--mr-border)' }}>
              <p className="text-sm font-bold">{i.title}</p>
              <p className="mr-body mt-0.5 whitespace-pre-line text-sm">{i.body}</p>
              {i.kind !== 'refill' && i.eventId ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onTaken(i)} className="mr-btn-primary px-4 py-2 text-sm">✓ Taken</button>
                  <button type="button" onClick={() => onSnooze(i)} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--mr-border)' }}>Snooze</button>
                  <button type="button" onClick={() => onSkip(i)} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--mr-border)' }}>Skip</button>
                  <button type="button" onClick={() => onDismiss(i.key)} aria-label="Dismiss" className="rounded-full border px-3 py-2 text-sm" style={{ borderColor: 'var(--mr-border)' }}>✕</button>
                </div>
              ) : (
                <div className="mt-2">
                  <button type="button" onClick={() => onDismiss(i.key)} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--mr-border)' }}>Dismiss</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
