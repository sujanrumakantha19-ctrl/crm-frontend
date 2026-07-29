import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notificationService } from '@/services/notifications'

vi.mock('@/lib/api', () => {
  const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), setToken: vi.fn(), clearToken: vi.fn() }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})
import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('notificationService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll should call GET /notifications with params', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await notificationService.getAll({ limit: 50, sort: '-createdAt' })
    expect(mockApi.get).toHaveBeenCalledWith('/notifications', { limit: 50, sort: '-createdAt' })
  })

  it('getUnread should call GET /notifications/unread', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await notificationService.getUnread()
    expect(mockApi.get).toHaveBeenCalledWith('/notifications/unread')
  })

  it('markAsRead should call PUT /notifications/:id/read', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await notificationService.markAsRead('n1')
    expect(mockApi.put).toHaveBeenCalledWith('/notifications/n1/read')
  })

  it('markAllAsRead should call PUT /notifications/read/all', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await notificationService.markAllAsRead()
    expect(mockApi.put).toHaveBeenCalledWith('/notifications/read/all')
  })

  it('create should call POST /notifications', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: 'new' } })
    await notificationService.create({ type: 'new_lead', message: 'Test' })
    expect(mockApi.post).toHaveBeenCalledWith('/notifications', { type: 'new_lead', message: 'Test' })
  })

  it('delete should call DELETE /notifications/:id', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await notificationService.delete('n1')
    expect(mockApi.delete).toHaveBeenCalledWith('/notifications/n1')
  })
})
