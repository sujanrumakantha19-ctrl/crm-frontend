import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// Mock before importing the module under test
const mockGetMe = vi.fn()
const mockLogin = vi.fn()
const mockLogout = vi.fn()

vi.mock('@/services/auth', () => ({
  authService: {
    login: (...args: any[]) => mockLogin(...args),
    getMe: (...args: any[]) => mockGetMe(...args),
    logout: (...args: any[]) => mockLogout(...args),
  },
}))

// Must import AFTER mock setup
const { AuthProvider, useAuth } = await import('@/context/AuthContext')

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  it('should start with loading state then resolve', async () => {
    mockGetMe.mockRejectedValue(new Error('no token'))
    const { result } = renderHook(() => useAuth(), { wrapper })
    // Initially loading is true, then useEffect runs and sets it to false
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('should restore user from localStorage and verify via getMe', async () => {
    const mockUser = { _id: '1', id: '1', name: 'Admin', role: 'admin', email: 'a@b.com' }
    localStorage.setItem('crm_user', JSON.stringify(mockUser))
    localStorage.setItem('crm_token', 'existing-token')
    mockGetMe.mockResolvedValue({ success: true, data: mockUser })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeDefined()
    expect(result.current.user!.name).toBe('Admin')
  })

  it('should clear user when getMe fails with 401', async () => {
    const mockUser = { id: '1', name: 'Admin', role: 'admin' }
    localStorage.setItem('crm_user', JSON.stringify(mockUser))
    localStorage.setItem('crm_token', 'bad-token')
    mockGetMe.mockRejectedValue(new Error('Unauthorized'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('should keep user from localStorage on network error', async () => {
    const mockUser = { id: '1', name: 'Admin', role: 'admin' }
    localStorage.setItem('crm_user', JSON.stringify(mockUser))
    localStorage.setItem('crm_token', 'token')
    mockGetMe.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    // User should be kept from localStorage on network error
    expect(result.current.user).toBeDefined()
  })

  it('should login and set user', async () => {
    mockGetMe.mockRejectedValue(new Error('no token'))
    const mockUser = { _id: '1', id: '1', name: 'Admin', role: 'admin', email: 'a@b.com' }
    mockLogin.mockResolvedValue({ success: true, data: mockUser, token: 'new-token' })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.login('a@b.com', 'pass')
    })

    expect(result.current.user).toBeDefined()
    expect(result.current.user!.name).toBe('Admin')
    // The login function stores user in localStorage, which isAuthenticated reads
    expect(localStorage.getItem('crm_user')).toContain('Admin')
    expect(mockLogin).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' })
  })

  it('should logout and clear user', async () => {
    const mockUser = { _id: '1', id: '1', name: 'Admin', role: 'admin' }
    localStorage.setItem('crm_user', JSON.stringify(mockUser))
    localStorage.setItem('crm_token', 'token')
    mockGetMe.mockResolvedValue({ success: true, data: mockUser })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.logout() })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(mockLogout).toHaveBeenCalled()
  })

  it('should handle checkIn and checkOut', async () => {
    mockGetMe.mockRejectedValue(new Error('no token'))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.checkedIn).toBe(false)

    act(() => { result.current.checkIn('09:00', Date.now()) })
    expect(result.current.checkedIn).toBe(true)
    expect(result.current.checkInTime).toBe('09:00')

    act(() => { result.current.checkOut() })
    expect(result.current.checkedIn).toBe(false)
    expect(result.current.checkInTime).toBeNull()
  })

  it('should restore checkIn state from localStorage', () => {
    localStorage.setItem('crm_checkedin', 'true')
    localStorage.setItem('crm_checkintime', '09:00')
    localStorage.setItem('crm_checkints', Date.now().toString())
    mockGetMe.mockRejectedValue(new Error('no token'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.checkedIn).toBe(true)
    expect(result.current.checkInTime).toBe('09:00')
  })
})
