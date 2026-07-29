import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// Mock before importing the module under test
const mockGetAll = vi.fn()
const mockMarkAsRead = vi.fn()
const mockMarkAllAsRead = vi.fn()
const mockCreate = vi.fn()

vi.mock('@/services', () => ({
  notificationService: {
    getAll: (...args: any[]) => mockGetAll(...args),
    markAsRead: (...args: any[]) => mockMarkAsRead(...args),
    markAllAsRead: (...args: any[]) => mockMarkAllAsRead(...args),
    create: (...args: any[]) => mockCreate(...args),
  },
}))

// Must import AFTER mock setup
const { NotificationProvider, useNotifications } = await import('@/context/NotificationContext')

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NotificationProvider>{children}</NotificationProvider>
  )

  it('should not load notifications when no token', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })
    expect(result.current.notifications.length).toBe(0)
    expect(mockGetAll).not.toHaveBeenCalled()
  })

  it('should load notifications on mount when token exists', async () => {
    localStorage.setItem('crm_token', 'token')
    mockGetAll.mockResolvedValue({
      success: true,
      data: [
        { id: '1', type: 'new_lead', message: 'Lead created', isRead: false, isToday: true, timeAgo: '1m' },
        { id: '2', type: 'task_assigned', message: 'Task assigned', isRead: true, isToday: false, timeAgo: '2d' },
      ],
    })

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => {
      expect(result.current.notifications.length).toBe(2)
    })
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })

  it('should compute unreadCount correctly', async () => {
    localStorage.setItem('crm_token', 'token')
    mockGetAll.mockResolvedValue({
      success: true,
      data: [
        { id: '1', type: 'new_lead', message: 'Lead created', isRead: false, isToday: true, timeAgo: '1m' },
        { id: '2', type: 'task_assigned', message: 'Task assigned', isRead: true, isToday: false, timeAgo: '2d' },
      ],
    })

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.notifications.length).toBe(2))
    expect(result.current.unreadCount).toBe(1)
  })

  it('should mark single notification as read', async () => {
    localStorage.setItem('crm_token', 'token')
    mockGetAll.mockResolvedValue({
      success: true,
      data: [
        { id: '1', type: 'new_lead', message: 'Lead', isRead: false, isToday: true, timeAgo: '1m' },
        { id: '2', type: 'birthday', message: 'BD', isRead: false, isToday: true, timeAgo: '1m' },
      ],
    })
    mockMarkAsRead.mockResolvedValue({ success: true, data: {} })

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.notifications.length).toBe(2))

    act(() => { result.current.markRead('1') })

    expect(result.current.unreadCount).toBe(1)
    expect(mockMarkAsRead).toHaveBeenCalledWith('1')
  })

  it('should mark all notifications as read', async () => {
    localStorage.setItem('crm_token', 'token')
    mockGetAll.mockResolvedValue({
      success: true,
      data: [
        { id: '1', type: 'new_lead', message: 'Lead', isRead: false, isToday: true, timeAgo: '1m' },
      ],
    })
    mockMarkAllAsRead.mockResolvedValue({ success: true, data: {} })

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.notifications.length).toBe(1))

    act(() => { result.current.markAllRead() })

    expect(result.current.unreadCount).toBe(0)
    expect(mockMarkAllAsRead).toHaveBeenCalled()
  })

  it('should add a new notification', async () => {
    localStorage.setItem('crm_token', 'token')
    mockGetAll.mockResolvedValue({
      success: true,
      data: [
        { id: '1', type: 'new_lead', message: 'Lead', isRead: false, isToday: true, timeAgo: '1m' },
      ],
    })
    mockCreate.mockResolvedValue({ success: true, data: {} })

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.notifications.length).toBe(1))

    act(() => {
      result.current.addNotification({
        type: 'booking',
        message: 'New booking',
        userId: '1',
      })
    })

    expect(result.current.notifications.length).toBe(2)
    expect(result.current.notifications[0].message).toBe('New booking')
    expect(result.current.notifications[0].isRead).toBe(false)
    expect(result.current.notifications[0].isToday).toBe(true)
  })

  it('should fetch more notifications', async () => {
    localStorage.setItem('crm_token', 'token')
    mockGetAll
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: '1', type: 'new_lead', message: 'Lead', isRead: false, isToday: true, timeAgo: '1m' }],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: '3', type: 'birthday', message: 'BD', isRead: false, isToday: false, timeAgo: '5d' }],
      })

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.notifications.length).toBe(1))

    await act(async () => { await result.current.fetchMore() })

    expect(result.current.notifications.length).toBe(2)
  })
})
