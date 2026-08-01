import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Capacitor modules before importing pushService
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
    getPlatform: vi.fn().mockReturnValue('android'),
  },
}))

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    register: vi.fn(),
    removeAllListeners: vi.fn(),
    addListener: vi.fn(),
    createChannel: vi.fn(),
  },
}))

vi.mock('../auth', () => ({
  authService: {
    savePushToken: vi.fn(),
    removePushToken: vi.fn(),
  },
}))

import { pushService } from '../push'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

const mockCapacitor = vi.mocked(Capacitor)
const mockPush = vi.mocked(PushNotifications)

describe('pushService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('initializePush', () => {
    it('should skip web push when the Web Push API is unsupported', async () => {
      mockCapacitor.isNativePlatform.mockReturnValue(false)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await pushService.initializePush(vi.fn())

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Web Push API not supported')
      )
      expect(mockPush.register).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should not request permissions when already granted', async () => {
      mockCapacitor.isNativePlatform.mockReturnValue(true)
      mockPush.checkPermissions.mockResolvedValue({ receive: 'granted' })
      mockPush.addListener.mockResolvedValue(undefined as any)

      await pushService.initializePush(vi.fn())

      expect(mockPush.checkPermissions).toHaveBeenCalled()
      expect(mockPush.requestPermissions).not.toHaveBeenCalled()
      expect(mockPush.register).toHaveBeenCalled()
    })

    it('should request permissions when status is prompt', async () => {
      mockCapacitor.isNativePlatform.mockReturnValue(true)
      mockPush.checkPermissions.mockResolvedValue({ receive: 'prompt' })
      mockPush.requestPermissions.mockResolvedValue({ receive: 'granted' })
      mockPush.addListener.mockResolvedValue(undefined as any)

      await pushService.initializePush(vi.fn())

      expect(mockPush.requestPermissions).toHaveBeenCalled()
      expect(mockPush.register).toHaveBeenCalled()
    })

    it('should not register when permission denied', async () => {
      mockCapacitor.isNativePlatform.mockReturnValue(true)
      mockPush.checkPermissions.mockResolvedValue({ receive: 'denied' })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await pushService.initializePush(vi.fn())

      expect(mockPush.register).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('handleNavigation', () => {
    it('should navigate to project by entityId and entityType', () => {
      const navigate = vi.fn()
      pushService.handleNavigation({ data: { entityId: 'proj1', entityType: 'Project' } } as any, navigate)
      expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/projects/proj1'))
    })

    it('should navigate to lead by entityType', () => {
      const navigate = vi.fn()
      pushService.handleNavigation({ data: { entityId: 'lead1', entityType: 'Lead' } } as any, navigate)
      expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/leads/lead1'))
    })

    it('should navigate to task by entityType', () => {
      const navigate = vi.fn()
      pushService.handleNavigation({ data: { entityId: 'task1', entityType: 'Task' } } as any, navigate)
      expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/tasks?taskId=task1'))
    })

    it('should navigate by notification type when no entityId', () => {
      const navigate = vi.fn()
      pushService.handleNavigation({ data: { type: 'task_assigned' } } as any, navigate)
      expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/tasks'))
    })

    it('should use role from localStorage for navigation base path', () => {
      const navigate = vi.fn()
      localStorage.setItem('crm_user', JSON.stringify({ role: 'admin' }))
      pushService.handleNavigation({ data: { type: 'new_lead' } } as any, navigate)
      expect(navigate).toHaveBeenCalledWith('/admin/leads')
    })
  })
})
