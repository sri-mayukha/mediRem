// Distinctive mediRem reminder identity — spec §21-23.
// Gentle two-note chime via WebAudio (offline, no assets) + short-pulse vibration.
// Where the platform denies custom sound/vibration/actions, we fall back gracefully.

let audioCtx: AudioContext | null = null

/** Play the calm mediRem chime: E5 -> B5, soft attack, warm decay. Returns false if unavailable/disabled. */
export function playMediRemChime(enabled: boolean): boolean {
  if (!enabled) return false
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return false
    audioCtx = audioCtx ?? new Ctx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    const t0 = audioCtx.currentTime + 0.01
    // Gentle lowpass keeps the chime warm and distinct from message/calendar pings.
    const filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2200
    filter.connect(audioCtx.destination)
    const notes = [659.25, 987.77] // E5, B5 — calm fifth, not an alarm
    notes.forEach((freq, i) => {
      const osc = audioCtx!.createOscillator()
      const gain = audioCtx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = t0 + i * 0.24
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.65)
      osc.connect(gain).connect(filter)
      osc.start(start)
      osc.stop(start + 0.7)
    })
    return true
  } catch {
    return false
  }
}

/** Preview the mediRem identity (chime + vibration) from Settings. */
export function previewReminderIdentity(sound: boolean, vibration: boolean): { sound: boolean; vibration: boolean } {
  return { sound: playMediRemChime(sound), vibration: vibrateMediRem(vibration) }
}

/** short pulse → pause → two short pulses. Returns false if unavailable/disabled. */
export function vibrateMediRem(enabled: boolean): boolean {
  if (!enabled) return false
  try {
    if (!('vibrate' in navigator)) return false
    return navigator.vibrate([80, 60, 60, 60, 120])
  } catch {
    return false
  }
}

export type NotificationKind = 'pre' | 'due' | 'refill'

export async function systemNotify(title: string, body: string, tag: string): Promise<'system' | 'unsupported'> {
  try {
    if (!('Notification' in window)) return 'unsupported'
    if (Notification.permission !== 'granted') return 'unsupported'
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      // Actions are best-effort: Chrome/Android support them, iOS/Safari may ignore.
      await reg.showNotification(title, {
        body,
        tag,
        // Relative so icons resolve under the Pages subpath (/mediRem/) as well as root.
        icon: 'icons/icon-192.svg',
        badge: 'icons/icon-192.svg',
        vibrate: [80, 60, 60, 60, 120],
        data: { tag },
        ...({ actions: [{ action: 'taken', title: 'Taken' }, { action: 'snooze', title: 'Snooze' }, { action: 'open', title: 'Open' }] } as object),
      } as NotificationOptions)
      return 'system'
    }
    // Foreground fallback tab notification
    const n = new Notification(title, { body, tag, icon: 'icons/icon-192.svg' })
    n.onclick = () => window.focus()
    return 'system'
  } catch {
    return 'unsupported'
  }
}

export function permissionState(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}
