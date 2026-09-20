import { describe, expect, it } from 'vitest'
import { greetingFor } from './greeting'

describe('greeting', () => {
  it('greets by time of day without health data', () => {
    expect(greetingFor(new Date(2026, 8, 20, 8, 0))).toBe('Good morning')
    expect(greetingFor(new Date(2026, 8, 20, 14, 0))).toBe('Good afternoon')
    expect(greetingFor(new Date(2026, 8, 20, 21, 0))).toBe('Good evening')
  })
})
