import { useMemo, useState } from 'react'
import type { HealthReading } from '../../types'

/** Calendar view of recorded period days. No predictions or medical claims. */
export function PeriodCalendar({ readings }: { readings: HealthReading[] }) {
  const today = new Date()
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() })

  const days = useMemo(() => {
    const set = new Set<string>()
    for (const r of readings) {
      const s = String(r.values.start ?? '')
      const e = String(r.values.end ?? s)
      if (!s) continue
      const [sy, sm, sd] = s.split('-').map(Number)
      const [ey, em, ed] = (e || s).split('-').map(Number)
      if (!sy || !ey) continue
      const cur = new Date(sy, sm - 1, sd)
      const end = new Date(ey, em - 1, ed)
      while (cur <= end) {
        set.add(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`)
        cur.setDate(cur.getDate() + 1)
      }
    }
    return set
  }, [readings])

  const first = new Date(ym.y, ym.m, 1)
  const startOffset = first.getDay()
  const dim = new Date(ym.y, ym.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array.from({ length: startOffset }, () => null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const title = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(first)

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setYm((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))} className="rounded-full border px-3 py-1.5" style={{ borderColor: 'var(--mr-border)' }}>‹</button>
        <p className="font-bold">{title}</p>
        <button type="button" aria-label="Next month" onClick={() => setYm((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))} className="rounded-full border px-3 py-1.5" style={{ borderColor: 'var(--mr-border)' }}>›</button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs" role="grid" aria-label={`Period calendar ${title}`}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="mr-muted font-semibold">{d}</span>)}
        {cells.map((day, i) => {
          if (day == null) return <span key={i} />
          const key = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const on = days.has(key)
          return (
            <span
              key={i}
              className="grid aspect-square place-items-center rounded-full text-sm"
              style={on ? { background: 'var(--mr-secondary)', color: '#fff', fontWeight: 700 } : undefined}
              aria-label={on ? `${key}, recorded period day` : key}
            >
              {day}
            </span>
          )
        })}
      </div>
    </div>
  )
}
