import type { ReactNode } from 'react'

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="mr-card mx-auto max-w-md p-8 text-center">
      {/* Subtle pill-ripple mark — no hospital cross per spec §65 */}
      <div aria-hidden="true" className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'color-mix(in srgb, var(--mr-primary) 16%, white)' }}>
        <svg width="28" height="28" viewBox="0 0 64 64" role="presentation">
          <g transform="rotate(-24 32 32)">
            <rect x="18" y="25" width="28" height="14" rx="7" fill="var(--mr-primary-deep)" />
            <rect x="18" y="25" width="14" height="14" rx="7" fill="var(--mr-secondary)" />
          </g>
        </svg>
      </div>
      <h2 className="mr-h2">{title}</h2>
      <p className="mr-muted mr-body mt-2">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
