import { exceptionTone } from '../lib/exceptionTone'

describe('exceptionTone', () => {
  test('returns success color when no exceptions are active', () => {
    expect(exceptionTone([])).toBe('#2e8f6d')
  })

  test('returns warning color for non-critical exceptions', () => {
    expect(exceptionTone([{ severity: 'warning' }])).toBe('#d69a1c')
  })

  test('returns critical color when any exception is critical', () => {
    const exceptions = [{ severity: 'warning' }, { severity: 'critical' }]

    expect(exceptionTone(exceptions)).toBe('#b4502a')
  })

  test('handles missing exceptions argument', () => {
    expect(exceptionTone()).toBe('#2e8f6d')
  })
})
