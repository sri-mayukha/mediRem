import { EmptyState } from '../components/EmptyState'

export function HistoryScreen() {
  return (
    <div className="space-y-4">
      <h1 className="mr-h1">History</h1>
      <EmptyState
        title="No history yet"
        body="Taken, skipped and missed doses plus health readings will appear here chronologically, with filters."
      />
    </div>
  )
}
