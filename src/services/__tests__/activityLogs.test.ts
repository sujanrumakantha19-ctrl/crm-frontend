import { describe, it, expect, vi, beforeEach } from 'vitest'
import { activityLogService } from '@/services/activityLogs'

vi.mock('@/lib/api', () => {
  const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), setToken: vi.fn(), clearToken: vi.fn() }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})
import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('activityLogService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll should call GET /activity-logs with params', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await activityLogService.getAll({ page: 1 })
    expect(mockApi.get).toHaveBeenCalledWith('/activity-logs', { page: 1 })
  })

  it('getRecent should call GET /activity-logs/recent with limit', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await activityLogService.getRecent(20)
    expect(mockApi.get).toHaveBeenCalledWith('/activity-logs/recent', { limit: 20 })
  })

  it('getRecent should default limit to 10', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await activityLogService.getRecent()
    expect(mockApi.get).toHaveBeenCalledWith('/activity-logs/recent', { limit: 10 })
  })

  it('getByEntity should call GET /activity-logs/entity/:entityType', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await activityLogService.getByEntity('Lead')
    expect(mockApi.get).toHaveBeenCalledWith('/activity-logs/entity/Lead')
  })

  it('getByAction should call GET /activity-logs/action/:actionType', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await activityLogService.getByAction('Created')
    expect(mockApi.get).toHaveBeenCalledWith('/activity-logs/action/Created')
  })

  it('create should call POST /activity-logs', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: 'new' } })
    await activityLogService.create({ action: 'Created lead', entityType: 'Lead' })
    expect(mockApi.post).toHaveBeenCalledWith('/activity-logs', { action: 'Created lead', entityType: 'Lead' })
  })

  it('delete should call DELETE /activity-logs/:id', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await activityLogService.delete('log1')
    expect(mockApi.delete).toHaveBeenCalledWith('/activity-logs/log1')
  })
})
