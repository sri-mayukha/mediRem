import { EmptyState } from '../components/EmptyState'

export function MedicinesScreen({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="space-y-4">
      <h1 className="mr-h1">Medicines</h1>
      <EmptyState
        title="No medications yet"
        body="Active, paused, completed and archived medications will live here with strength, dose, schedule and doctor's instructions."
        action={
          <button type="button" onClick={onAdd} className="mr-btn-primary px-5 py-3">
            + Add medication
          </button>
        }
      />
    </div>
  )
}
