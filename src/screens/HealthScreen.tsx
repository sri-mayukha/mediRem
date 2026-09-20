import { EmptyState } from '../components/EmptyState'

export function HealthScreen() {
  return (
    <div className="space-y-4">
      <h1 className="mr-h1">Health</h1>
      <EmptyState
        title="Nothing recorded yet"
        body="Blood pressure, glucose, weight, heart rate, SpO2, temperature, periods, symptoms and custom trackers arrive in Phase 2."
      />
    </div>
  )
}
