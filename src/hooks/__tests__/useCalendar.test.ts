import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useCalendar } from '@/hooks/useCalendar'

describe('useCalendar', () => {
  it('should generate calendar days for a month', () => {
    const { result } = renderHook(() => useCalendar(2024, 1)) // January 2024
    // Jan 2024 starts on Monday, 31 days + leading/filling days from prev/next month
    expect(result.current.length).toBeGreaterThanOrEqual(31)
    expect(result.current.length).toBeLessThanOrEqual(42) // max 6 weeks
  })

  it('should have correct dayOfMonth values', () => {
    const { result } = renderHook(() => useCalendar(2024, 6)) // June 2024
    const dayNumbers = result.current.map(d => d.dayOfMonth)
    // June has 30 days
    expect(dayNumbers).toContain(1)
    expect(dayNumbers).toContain(30)
  })

  it('should mark days from other months as not current month', () => {
    const { result } = renderHook(() => useCalendar(2024, 1)) // January 2024
    const otherMonthDays = result.current.filter(d => !d.isCurrentMonth)
    expect(otherMonthDays.length).toBeGreaterThan(0)
  })

  it('should mark today correctly', () => {
    const now = new Date()
    const { result } = renderHook(() => useCalendar(now.getFullYear(), now.getMonth() + 1))
    const today = result.current.find(d => d.isToday)
    expect(today).toBeDefined()
    expect(today!.dayOfMonth).toBe(now.getDate())
  })

  it('should generate correct keys in yyyy-MM-dd format', () => {
    const { result } = renderHook(() => useCalendar(2024, 3)) // March 2024
    result.current.forEach(d => {
      expect(d.key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  it('should start week on Monday', () => {
    // April 2024 starts on Monday
    const { result } = renderHook(() => useCalendar(2024, 4))
    const firstDay = result.current[0]
    expect(firstDay.date.getDay()).toBe(1) // Monday = 1
  })

  it('should return same reference for same year/month', () => {
    const { result, rerender } = renderHook(
      ({ year, month }) => useCalendar(year, month),
      { initialProps: { year: 2024, month: 6 } }
    )
    const first = result.current
    rerender({ year: 2024, month: 6 })
    expect(result.current).toBe(first) // memoized
  })

  it('should return different reference for different month', () => {
    const { result, rerender } = renderHook(
      ({ year, month }) => useCalendar(year, month),
      { initialProps: { year: 2024, month: 6 } }
    )
    const first = result.current
    rerender({ year: 2024, month: 7 })
    expect(result.current).not.toBe(first)
  })
})
