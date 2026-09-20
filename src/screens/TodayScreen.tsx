import { EmptyState } from '../components/EmptyState'
import { formatLongDate, greetingFor } from '../lib/greeting'

export function TodayScreen({ onAdd }: { onAdd: () => void }) {
  const now = new Date()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="mr-h1">{greetingFor(now)}</h1>
        <p className="mr-muted mr-body">{formatLongDate(now)}</p>
      </div>

      <section aria-labelledby="today-next" className="mr-card p-5">
        <h2 id="today-next" className="mr-h2">Next</h2>
        <p className="mr-muted mr-body mt-1">Nothing scheduled yet. Add your first medication to see it here.</p>
      </section>

      <section aria-labelledby="today-timeline" className="mr-card p-5">
        <h2 id="today-timeline" className="mr-h2">Today</h2>
        <div className="mt-3">
          <EmptyState
            title="No medications yet"
            body="Add your first medication to start building your schedule. Your data stays on this device."
            action={
              <button type="button" onClick={onAdd} className="mr-btn-primary px-5 py-3">
                + Add medication
              </button>
            }
          />
        </div>
      </section>

      <section aria-labelledby="today-attention" className="mr-card p-5">
        <h2 id="today-attention" className="mr-h2">Needs attention</h2>
        <p className="mr-muted mr-body mt-1">Refill warnings and missed doses will appear here.</p>
      </section>
    </div>
  )
}
