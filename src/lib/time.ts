// Local-time helpers. All scheduling uses device local time per spec §61.

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** "08:00" -> minutes since midnight. Throws on invalid. */
export function parseTimeToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) throw new Error(`Invalid time: ${hhmm}`)
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) throw new Error(`Invalid time: ${hhmm}`)
  return h * 60 + min
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${pad2(h)}:${pad2(m)}`
}

export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseLocalDateStr(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) throw new Error(`Invalid date: ${s}`)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0)
}

/** Combine local date + "HH:mm" -> timestamp. */
export function combineDateTime(day: Date, hhmm: string): number {
  const mins = parseTimeToMinutes(hhmm)
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(mins / 60), mins % 60, 0, 0)
  return d.getTime()
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

export function formatTimeLabel(at: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(at))
}

export function formatCountdown(fromMs: number, toMs: number): string {
  const diff = Math.max(0, toMs - fromMs)
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `in ${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000)
}
