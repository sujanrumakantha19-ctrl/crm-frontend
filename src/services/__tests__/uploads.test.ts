import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadService } from '@/services/uploads'

vi.mock('@/lib/api', () => {
  const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), upload: vi.fn(), setToken: vi.fn(), clearToken: vi.fn() }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})
import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('uploadService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upload should call api.upload with FormData for the category', async () => {
    mockApi.upload.mockResolvedValue({ success: true, data: [] })
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    await uploadService.upload('kyc', [file])
    expect(mockApi.upload).toHaveBeenCalledWith('/uploads/kyc', expect.any(FormData))
  })

  it('getFiles should call GET /uploads/:category', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await uploadService.getFiles('plots')
    expect(mockApi.get).toHaveBeenCalledWith('/uploads/plots')
  })

  it('deleteFile should call DELETE /uploads/:category/:filename', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await uploadService.deleteFile('kyc', 'doc123.pdf')
    expect(mockApi.delete).toHaveBeenCalledWith('/uploads/kyc/doc123.pdf')
  })
})
