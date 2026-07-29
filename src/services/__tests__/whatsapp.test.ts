import { describe, it, expect, vi, beforeEach } from 'vitest'
import { whatsappService } from '@/services/whatsapp'

vi.mock('@/lib/api', () => {
  const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), setToken: vi.fn(), clearToken: vi.fn() }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})
import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('whatsappService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('send should call POST /whatsapp/send with payload', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { _id: 'm1' } })
    await whatsappService.send({ phone: '9876543210', message: 'Hello' })
    expect(mockApi.post).toHaveBeenCalledWith('/whatsapp/send', { phone: '9876543210', message: 'Hello' })
  })

  it('send should include optional type and templateName', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: {} })
    await whatsappService.send({ phone: '9876543210', type: 'template', templateName: 'welcome', variables: ['John'] })
    expect(mockApi.post).toHaveBeenCalledWith('/whatsapp/send', {
      phone: '9876543210', type: 'template', templateName: 'welcome', variables: ['John'],
    })
  })

  it('getHistory should call GET /whatsapp/history/:phone', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await whatsappService.getHistory('9876543210')
    expect(mockApi.get).toHaveBeenCalledWith('/whatsapp/history/9876543210')
  })
})
