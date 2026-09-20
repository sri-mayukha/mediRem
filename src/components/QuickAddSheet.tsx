import { useEffect } from 'react'

/** Minimal bottom-sheet for Phase 0 +Add. Full QuickAdd forms land in Phase 1/2. */
export function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const items = [
    'Add medication (Phase 1)',
    'Record blood pressure (Phase 2)',
    'Record glucose (Phase 2)',
    'Record weight (Phase 2)',
    'Record symptom (Phase 2)',
  ]
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
        <p className="mr-muted mr-body mt-1">Common actions take very few taps. Full forms arrive in Phase 1–2.</p>
        <ul className="mt-4 space-y-2">
          {items.map((label) => (
            <li key={label}>
              <button type="button" disabled className="w-full rounded-2xl border px-4 py-3 text-left opacity-60" style={{ borderColor: 'var(--mr-border)' }}>
                {label}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="mr-btn-primary mt-5 w-full px-4 py-3">
          Close
        </button>
      </div>
    </div>
  )
}
