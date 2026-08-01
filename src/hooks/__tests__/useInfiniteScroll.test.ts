import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'

type IntersectCallback = (entries: Array<{ isIntersecting: boolean }>) => void

const observerInstances: Array<{ callback: IntersectCallback; disconnect: ReturnType<typeof vi.fn> }> = []

function createMockIntersectionObserver() {
  return class MockIntersectionObserver {
    callback: IntersectCallback
    disconnect = vi.fn()
    constructor(cb: IntersectCallback) {
      this.callback = cb
      observerInstances.push({ callback: this.callback, disconnect: this.disconnect })
    }
    observe() {}
    unobserve() {}
    takeRecords() { return [] }
  }
}

beforeAll(() => {
  ;(globalThis as any).IntersectionObserver = createMockIntersectionObserver()
})

function ok<T>(data: T[], next?: boolean) {
  return { success: true, data, pagination: next ? { next: { page: 2, limit: 20 } } : undefined }
}

describe('useInfiniteScroll', () => {
  it('should fetch the first page on mount', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok(['item1', 'item2'], true))
    const { result } = renderHook(() => useInfiniteScroll<string>({ fetchFn }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual(['item1', 'item2'])
    expect(result.current.hasMore).toBe(true)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('should set hasMore to false when no next page', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok(['only-page']))
    const { result } = renderHook(() => useInfiniteScroll<string>({ fetchFn }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasMore).toBe(false)
  })

  it('should append a subsequent page when the loader becomes visible', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(ok(['p1'], true))
      .mockResolvedValueOnce(ok(['p2'], false))
    const { result } = renderHook(() => useInfiniteScroll<string>({ fetchFn }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual(['p1'])

    // Simulate the loader element entering the viewport (use the latest observer
    // instance to avoid stale effect closures).
    await act(async () => {
      const latest = observerInstances[observerInstances.length - 1]
      latest.callback([{ isIntersecting: true }])
      await new Promise(r => setTimeout(r, 0))
    })

    await waitFor(() => expect(result.current.items).toEqual(['p1', 'p2']))
    expect(result.current.hasMore).toBe(false)
  })

  it('should avoid appending duplicate items', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(ok([{ id: 'p1' }, { id: 'p2' }], true))
      .mockResolvedValueOnce(ok([{ id: 'p1' }, { id: 'p3' }], false))
    const { result } = renderHook(() => useInfiniteScroll<{ id: string }>({ fetchFn }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([{ id: 'p1' }, { id: 'p2' }])

    await act(async () => {
      const latest = observerInstances[observerInstances.length - 1]
      latest.callback([{ isIntersecting: true }])
      await new Promise(r => setTimeout(r, 0))
    })

    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]))
  })

  it('should reset and refetch page 1', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(ok(['old'], true))
      .mockResolvedValueOnce(ok(['fresh'], true))
    const { result } = renderHook(() => useInfiniteScroll<string>({ fetchFn }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual(['old'])

    act(() => { result.current.reset() })
    await waitFor(() => expect(result.current.items).toEqual(['fresh']))
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('should surface fetch errors', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('Server error'))
    const { result } = renderHook(() => useInfiniteScroll<string>({ fetchFn }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Server error')
  })
})
