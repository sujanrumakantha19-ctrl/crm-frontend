import { describe, it, expect, vi, beforeEach } from 'vitest'
import { userService } from '@/services/users'

vi.mock('@/lib/api', () => {
  const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), setToken: vi.fn(), clearToken: vi.fn() }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})
import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('userService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll should call GET /users with params', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await userService.getAll({ role: 'staff' })
    expect(mockApi.get).toHaveBeenCalledWith('/users', { role: 'staff' })
  })

  it('getById should call GET /users/:id', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: {} })
    await userService.getById('u1')
    expect(mockApi.get).toHaveBeenCalledWith('/users/u1')
  })

  it('create should call POST /users with password', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: 'new' } })
    await userService.create({ name: 'New', email: 'n@b.com', password: 'pass123' })
    expect(mockApi.post).toHaveBeenCalledWith('/users', { name: 'New', email: 'n@b.com', password: 'pass123' })
  })

  it('update should call PUT /users/:id', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await userService.update('u1', { name: 'Updated' })
    expect(mockApi.put).toHaveBeenCalledWith('/users/u1', { name: 'Updated' })
  })

  it('delete should call DELETE /users/:id', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await userService.delete('u1')
    expect(mockApi.delete).toHaveBeenCalledWith('/users/u1')
  })
})
