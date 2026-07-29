import { describe, it, expect, vi, beforeEach } from 'vitest'
import { channelPartnerService } from '@/services/channelPartners'

vi.mock('@/lib/api', () => {
  const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), setToken: vi.fn(), clearToken: vi.fn() }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})
import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('channelPartnerService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll should call GET /channel-partners', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await channelPartnerService.getAll({ city: 'Hyd' })
    expect(mockApi.get).toHaveBeenCalledWith('/channel-partners', { city: 'Hyd' })
  })

  it('getById should call GET /channel-partners/:id', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: {} })
    await channelPartnerService.getById('cp1')
    expect(mockApi.get).toHaveBeenCalledWith('/channel-partners/cp1')
  })

  it('getActive should call GET /channel-partners/active', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await channelPartnerService.getActive()
    expect(mockApi.get).toHaveBeenCalledWith('/channel-partners/active')
  })

  it('create should call POST /channel-partners', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: 'new' } })
    await channelPartnerService.create({ name: 'Partner', phone: '123' })
    expect(mockApi.post).toHaveBeenCalledWith('/channel-partners', { name: 'Partner', phone: '123' })
  })

  it('update should call PUT /channel-partners/:id', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await channelPartnerService.update('cp1', { name: 'Updated' })
    expect(mockApi.put).toHaveBeenCalledWith('/channel-partners/cp1', { name: 'Updated' })
  })

  it('delete should call DELETE /channel-partners/:id', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await channelPartnerService.delete('cp1')
    expect(mockApi.delete).toHaveBeenCalledWith('/channel-partners/cp1')
  })
})
