import { useEffect, useRef, useState } from 'react'

export function ConfirmationDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div role="alertdialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-40 grid place-items-center p-5" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/35" aria-hidden="true" />
      <div className="mr-card relative w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mr-h2">{title}</h2>
        <p className="mr-muted mr-body mt-2">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-full border px-5 py-2.5 font-semibold" style={{ borderColor: 'var(--mr-border)' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="mr-btn-primary px-5 py-2.5">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const show = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600)
  }
  const node = msg ? (
    <div role="status" className="fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full px-5 py-2.5 font-medium text-white" style={{ background: 'var(--mr-primary-deep)' }}>
      {msg}
    </div>
  ) : null
  return { show, node }
}
