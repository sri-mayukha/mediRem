import { useEffect } from 'react'

export function QuickAddSheet({
  open,
  onClose,
  onAddMedication,
}: {
  open: boolean
  onClose: () => void
  onAddMedication: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="Quick add" className="fixed inset-0 z-30" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <div
        className="mr-card absolute inset-x-0 bottom-0 mx-auto max-w-xl p-5 pb-8"
        style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'var(--mr-border)' }} />
        <h2 className="mr-h2">Quick add</h2>
        <p className="mr-muted mr-body mt-1">Common actions take very few taps.</p>
        <ul className="mt-4 space-y-2">
          <li>
            <button
              type="button"
              onClick={() => {
                onClose()
                onAddMedication()
              }}
              className="mr-btn-primary w-full px-4 py-3"
            >
              + Add medication
            </button>
          </li>
          {['Record blood pressure (Phase 2)', 'Record glucose (Phase 2)', 'Record weight (Phase 2)', 'Record symptom (Phase 2)'].map((label) => (
            <li key={label}>
              <button type="button" disabled className="w-full rounded-2xl border px-4 py-3 text-left opacity-60" style={{ borderColor: 'var(--mr-border)' }}>
                {label}
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
