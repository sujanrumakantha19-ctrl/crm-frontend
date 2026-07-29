import { describe, it, expect, vi, beforeEach } from 'vitest'
import { groupService } from '@/services/groups'

vi.mock('@/lib/api', () => {
  const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), setToken: vi.fn(), clearToken: vi.fn() }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})
import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('groupService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll should call GET /groups', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await groupService.getAll()
    expect(mockApi.get).toHaveBeenCalledWith('/groups', undefined)
  })

  it('getById should call GET /groups/:id', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: {} })
    await groupService.getById('g1')
    expect(mockApi.get).toHaveBeenCalledWith('/groups/g1')
  })

  it('create should call POST /groups', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: 'new' } })
    await groupService.create({ name: 'Sales Team' })
    expect(mockApi.post).toHaveBeenCalledWith('/groups', { name: 'Sales Team' })
  })

  it('update should call PUT /groups/:id', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await groupService.update('g1', { name: 'Updated' })
    expect(mockApi.put).toHaveBeenCalledWith('/groups/g1', { name: 'Updated' })
  })

  it('delete should call DELETE /groups/:id', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await groupService.delete('g1')
    expect(mockApi.delete).toHaveBeenCalledWith('/groups/g1')
  })

  it('addMember should call POST /groups/:id/members with userId', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: {} })
    await groupService.addMember('g1', 'u1')
    expect(mockApi.post).toHaveBeenCalledWith('/groups/g1/members', { userId: 'u1' })
  })

  it('removeMember should call DELETE /groups/:id/members/:userId', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await groupService.removeMember('g1', 'u1')
    expect(mockApi.delete).toHaveBeenCalledWith('/groups/g1/members/u1')
  })
})
