import { useEffect, useState } from 'react'
import type { AppSettings } from '../types'
import { db } from './database'

export const DEFAULT_SETTINGS: AppSettings = {
  medicationReminders: true,
  reminderLeadMinutes: 3,
  sound: true,
  vibration: true,
  refillReminders: true,
  snoozeMinutes: 10,
  missedGraceMinutes: 60,
  theme: 'system',
  weightUnit: 'kg',
  tempUnit: 'C',
  glucoseUnit: 'mg/dL',
}

const SETTINGS_KEY = 'app-settings'

export async function loadSettings(): Promise<AppSettings> {
  const row = await db.kv.get(SETTINGS_KEY)
  if (!row) {
    await db.kv.put({ key: SETTINGS_KEY, value: DEFAULT_SETTINGS })
    return DEFAULT_SETTINGS
  }
  return { ...DEFAULT_SETTINGS, ...((row.value as Partial<AppSettings>) ?? {}) }
}

export async function saveSettings(next: AppSettings): Promise<void> {
  await db.kv.put({ key: SETTINGS_KEY, value: next })
}

/** Apply light/dark/system to <html data-theme>. */
export function applyTheme(theme: AppSettings['theme']): void {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
    return
  }
  root.setAttribute('data-theme', theme)
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    loadSettings()
      .then((s) => {
        if (!alive) return
        setSettings(s)
        applyTheme(s.theme)
        setReady(true)
      })
      .catch(() => {
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const update = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    applyTheme(next.theme)
    try {
      await saveSettings(next)
    } catch {
      // Offline-first: IndexedDB should be available; if not, keep in-memory and inform later.
    }
  }

  return { settings, update, ready }
}
