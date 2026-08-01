import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useApi, usePaginated } from '@/hooks/useApi'
import type { ApiResponse } from '@/lib/api'

// Helper to create mock API responses
function ok<T>(data: T, count?: number, pagination?: ApiResponse['pagination']): ApiResponse<T> {
  return { success: true, data, count, pagination }
}

describe('useApi', () => {
  it('should fetch data on mount when immediate is true', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok('test-data'))
    const { result } = renderHook(() => useApi(fetcher))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe('test-data')
    expect(result.current.error).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('should not fetch on mount when immediate is false', () => {
    const fetcher = vi.fn().mockResolvedValue(ok('data'))
    const { result } = renderHook(() => useApi(fetcher, [], { immediate: false }))

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('should set error when fetcher throws', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useApi(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.data).toBeNull()
  })

  it('should handle non-Error thrown values', async () => {
    const fetcher = vi.fn().mockRejectedValue('string error')
    const { result } = renderHook(() => useApi(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Unknown error')
  })

  it('should re-fetch when execute is called manually', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok('data'))
    const { result } = renderHook(() => useApi(fetcher, [], { immediate: false }))

    expect(fetcher).not.toHaveBeenCalled()
    await act(async () => { await result.current.execute() })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.data).toBe('data')
  })

  it('should allow setting data directly via setData', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok('original'))
    const { result } = renderHook(() => useApi(fetcher))

    await waitFor(() => expect(result.current.data).toBe('original'))
    act(() => { result.current.setData('override' as any) })
    expect(result.current.data).toBe('override')
  })
})

describe('usePaginated', () => {
  it('should fetch first page on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(['item1', 'item2'], 50, { next: { page: 2, limit: 25 } }))
    const { result } = renderHook(() => usePaginated(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(['item1', 'item2'])
    expect(result.current.total).toBe(50)
    expect(result.current.hasNext).toBe(true)
    expect(result.current.hasPrev).toBe(false)
    expect(result.current.page).toBe(1)
  })

  it('should navigate to next page', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(ok(['p1'], 50, { next: { page: 2, limit: 25 } }))
      .mockResolvedValueOnce(ok(['p2'], 50, { next: { page: 3, limit: 25 }, prev: { page: 1, limit: 25 } }))
    const { result } = renderHook(() => usePaginated(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(['p1'])

    act(() => { result.current.nextPage() })
    await waitFor(() => expect(result.current.page).toBe(2))
    expect(result.current.data).toEqual(['p2'])
  })

  it('should navigate to previous page', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(ok(['p1'], 50, { next: { page: 2, limit: 25 } }))
      .mockResolvedValueOnce(ok(['p2'], 50, { next: { page: 3, limit: 25 }, prev: { page: 1, limit: 25 } }))
      .mockResolvedValueOnce(ok(['p1'], 50, { next: { page: 2, limit: 25 } }))
    const { result } = renderHook(() => usePaginated(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.nextPage() })
    await waitFor(() => expect(result.current.page).toBe(2))
    act(() => { result.current.prevPage() })
    await waitFor(() => expect(result.current.page).toBe(1))
  })

  it('should not go to next page when hasNext is false', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(['p1'], 5))
    const { result } = renderHook(() => usePaginated(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasNext).toBe(false)
    act(() => { result.current.nextPage() })
    expect(fetcher).toHaveBeenCalledTimes(1) // no extra call
  })

  it('should set error on failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Server error'))
    const { result } = renderHook(() => usePaginated(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Server error')
    expect(result.current.data).toEqual([])
  })

  it('should refresh current page', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(ok(['p1'], 5, { next: { page: 2, limit: 25 } }))
      .mockResolvedValueOnce(ok(['p1-updated'], 5, { next: { page: 2, limit: 25 } }))
    const { result } = renderHook(() => usePaginated(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.data).toEqual(['p1-updated']))
  })
})
