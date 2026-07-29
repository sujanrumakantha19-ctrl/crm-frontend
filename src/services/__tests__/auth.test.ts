import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from '@/services/auth'

// Mock the api module
vi.mock('@/lib/api', () => {
  const mockApi = {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn(),
  }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})

import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call login and store token', async () => {
    mockApi.post.mockResolvedValue({
      success: true,
      data: { id: '1', name: 'Admin', role: 'admin', email: 'a@b.com' },
      token: 'jwt-token-123',
    })

    const result = await authService.login({ email: 'a@b.com', password: 'pass' })

    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'pass' })
    expect(mockApi.setToken).toHaveBeenCalledWith('jwt-token-123')
    expect(result.token).toBe('jwt-token-123')
  })

  it('should call register and store token', async () => {
    mockApi.post.mockResolvedValue({
      success: true,
      data: { id: '2', name: 'Partner', role: 'partner', email: 'p@b.com' },
      token: 'reg-token',
    })

    await authService.register({
      name: 'Partner', initials: 'PT', role: 'partner',
      email: 'p@b.com', phone: '123', password: 'pass123',
    })

    expect(mockApi.post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({
      name: 'Partner', email: 'p@b.com',
    }))
    expect(mockApi.setToken).toHaveBeenCalledWith('reg-token')
  })

  it('should call getMe', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: { id: '1', name: 'Admin' } })
    await authService.getMe()
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
  })

  it('should call forgotPassword', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: {} })
    await authService.forgotPassword('a@b.com')
    expect(mockApi.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@b.com' })
  })

  it('should call resetPassword', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: {} })
    await authService.resetPassword('token123', 'newpass')
    expect(mockApi.post).toHaveBeenCalledWith('/auth/reset-password', { token: 'token123', newPassword: 'newpass' })
  })

  it('should call updateProfile', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: { name: 'Updated' } })
    await authService.updateProfile({ name: 'Updated' })
    expect(mockApi.put).toHaveBeenCalledWith('/auth/update-profile', { name: 'Updated' })
  })

  it('should call changePassword', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await authService.changePassword('oldpass', 'newpass')
    expect(mockApi.put).toHaveBeenCalledWith('/auth/change-password', { currentPassword: 'oldpass', newPassword: 'newpass' })
  })

  it('should call savePushToken', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await authService.savePushToken('push-token', 'android')
    expect(mockApi.put).toHaveBeenCalledWith('/auth/push-token', { token: 'push-token', platform: 'android' })
  })

  it('should call removePushToken', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await authService.removePushToken('push-token')
    expect(mockApi.delete).toHaveBeenCalledWith('/auth/push-token', { token: 'push-token' })
  })

  it('should clear token on logout', () => {
    authService.logout()
    expect(mockApi.clearToken).toHaveBeenCalled()
  })

  it('should not store token when login response has no token', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: '1' } })
    await authService.login({ email: 'a@b.com', password: 'pass' })
    expect(mockApi.setToken).not.toHaveBeenCalled()
  })
})
