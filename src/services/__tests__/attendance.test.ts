import { describe, it, expect, vi, beforeEach } from 'vitest'
import { attendanceService } from '@/services/attendance'

vi.mock('@/lib/api', () => {
  const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), setToken: vi.fn(), clearToken: vi.fn() }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})
import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('attendanceService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll should call GET /attendance with params', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await attendanceService.getAll({ staffId: 's1', page: 1 })
    expect(mockApi.get).toHaveBeenCalledWith('/attendance', { staffId: 's1', page: 1 })
  })

  it('getById should call GET /attendance/:id', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: {} })
    await attendanceService.getById('a1')
    expect(mockApi.get).toHaveBeenCalledWith('/attendance/a1')
  })

  it('getByStaff should call GET /attendance/staff/:staffId', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await attendanceService.getByStaff('s1')
    expect(mockApi.get).toHaveBeenCalledWith('/attendance/staff/s1', undefined)
  })

  it('getByDate should call GET /attendance/date/:date', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await attendanceService.getByDate('2024-01-15')
    expect(mockApi.get).toHaveBeenCalledWith('/attendance/date/2024-01-15')
  })

  it('getToday should call GET /attendance/today', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await attendanceService.getToday()
    expect(mockApi.get).toHaveBeenCalledWith('/attendance/today')
  })

  it('getTodayPresence should call GET /attendance/presence/today', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await attendanceService.getTodayPresence()
    expect(mockApi.get).toHaveBeenCalledWith('/attendance/presence/today')
  })

  it('getDaily should call GET /attendance/daily with params', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await attendanceService.getDaily({ date: '2024-01-15' })
    expect(mockApi.get).toHaveBeenCalledWith('/attendance/daily', { date: '2024-01-15' })
  })

  it('setOverride should call POST /attendance/override', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: {} })
    await attendanceService.setOverride({ staffId: 's1', date: '2024-01-15', status: 'Present' })
    expect(mockApi.post).toHaveBeenCalledWith('/attendance/override', { staffId: 's1', date: '2024-01-15', status: 'Present' })
  })

  it('create should call POST /attendance', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: 'new' } })
    await attendanceService.create({ staffId: 's1', status: 'Present' })
    expect(mockApi.post).toHaveBeenCalledWith('/attendance', { staffId: 's1', status: 'Present' })
  })

  it('update should call PUT /attendance/:id', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await attendanceService.update('a1', { checkOut: '18:00' })
    expect(mockApi.put).toHaveBeenCalledWith('/attendance/a1', { checkOut: '18:00' })
  })

  it('delete should call DELETE /attendance/:id', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await attendanceService.delete('a1')
    expect(mockApi.delete).toHaveBeenCalledWith('/attendance/a1')
  })
})
