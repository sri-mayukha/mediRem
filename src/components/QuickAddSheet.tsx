import { useEffect, useRef } from 'react'
import type { TrackerKey } from '../types'

const READINGS: { key: TrackerKey; label: string }[] = [
  { key: 'bp', label: 'Record blood pressure' },
  { key: 'glucose', label: 'Record glucose' },
  { key: 'weight', label: 'Record weight' },
  { key: 'hr', label: 'Record heart rate' },
  { key: 'spo2', label: 'Record SpO2' },
  { key: 'temp', label: 'Record temperature' },
  { key: 'period', label: 'Record period' },
  { key: 'symptom', label: 'Record symptom' },
]

export function QuickAddSheet({
  open,
  onClose,
  onAddMedication,
  onAddReading,
}: {
  open: boolean
  onClose: () => void
  onAddMedication: () => void
  onAddReading: (key: TrackerKey) => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Move keyboard focus into the dialog for screen-reader/keyboard users.
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const pick = (fn: () => void) => () => {
    onClose()
    fn()
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Quick add" className="fixed inset-0 z-30" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="mr-card absolute inset-x-0 bottom-0 mx-auto max-w-xl p-5 pb-8"
        style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxHeight: '85dvh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'var(--mr-border)' }} />
        <h2 className="mr-h2">Quick add</h2>
        <p className="mr-muted mr-body mt-1">Common actions take very few taps.</p>
        <ul className="mt-4 space-y-2">
          <li>
            <button type="button" onClick={pick(onAddMedication)} className="mr-btn-primary w-full px-4 py-3">
              + Add medication
            </button>
          </li>
          {READINGS.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={pick(() => onAddReading(r.key))}
                className="w-full rounded-2xl border px-4 py-3 text-left font-medium"
                style={{ borderColor: 'var(--mr-border)' }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="mt-3 w-full rounded-full border px-4 py-3 font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
          Close
        </button>
      </div>
    </div>
  )
}
