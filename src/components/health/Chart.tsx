import { useMemo } from 'react'
import type { HealthReading } from '../../types'

export interface LinePoint {
  t: number
  v: number
}

/** Recorded-points-only series. No interpolation or invented values — one point per reading. */
export function toLinePoints(readings: HealthReading[], pick: (r: HealthReading) => number | null): LinePoint[] {
  const pts: LinePoint[] = []
  for (const r of readings) {
    const v = pick(r)
    if (v == null || !Number.isFinite(v)) continue
    pts.push({ t: r.timestamp, v })
  }
  return pts.sort((a, b) => a.t - b.t)
}

const numOf = (v: number | string | undefined): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const pickers = {
  bpSys: (r: HealthReading) => numOf(r.values.systolic),
  bpDia: (r: HealthReading) => numOf(r.values.diastolic),
  value: (r: HealthReading) => numOf(r.values.value),
  severity: (r: HealthReading) => numOf(r.values.severity),
  pain: (r: HealthReading) => numOf(r.values.pain),
}

export function MiniChart({
  series,
  height = 120,
  unit,
  label,
}: {
  series: { color: string; points: LinePoint[]; name: string }[]
  height?: number
  unit?: string
  label: string
}) {
  const W = 300
  const H = height
  const PAD = 8

  const { min, max, all } = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    if (all.length === 0) return { min: 0, max: 1, all }
    let min = Math.min(...all.map((p) => p.v))
    let max = Math.max(...all.map((p) => p.v))
    if (min === max) {
      min -= 1
      max += 1
    }
    const pad = (max - min) * 0.15
    return { min: min - pad, max: max + pad, all }
  }, [series])

  if (all.length === 0) {
    return <p className="mr-muted text-sm">Not enough recorded data for a chart yet.</p>
  }

  const t0 = Math.min(...all.map((p) => p.t))
  const t1 = Math.max(...all.map((p) => p.t))
  const span = Math.max(1, t1 - t0)
  const x = (t: number) => PAD + ((t - t0) / span) * (W - PAD * 2)
  const y = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2)

  return (
    <figure aria-label={label} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="var(--mr-border)" strokeWidth={1} />
        ))}
        {series.map((s) =>
          s.points.length === 1 ? (
            <circle key={s.name} cx={x(s.points[0].t)} cy={y(s.points[0].v)} r={4} fill={s.color} />
          ) : (
            <g key={s.name}>
              <polyline
                points={s.points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.points.map((p) => (
                <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r={2.5} fill={s.color} />
              ))}
            </g>
          ),
        )}
      </svg>
      <figcaption className="mr-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
        {series.map((s) => (
          <span key={s.name}><span aria-hidden="true" style={{ color: s.color }}>●</span> {s.name}</span>
        ))}
        {unit ? <span>{unit}</span> : null}
        <span>· recorded readings only</span>
      </figcaption>
    </figure>
  )
}
