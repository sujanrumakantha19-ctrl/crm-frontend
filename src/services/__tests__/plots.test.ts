import { describe, it, expect, vi, beforeEach } from 'vitest'
import { plotService } from '@/services/plots'

vi.mock('@/lib/api', () => {
  const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), setToken: vi.fn(), clearToken: vi.fn() }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})
import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('plotService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll should call GET /plots with params', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await plotService.getAll({ projectId: 'p1' })
    expect(mockApi.get).toHaveBeenCalledWith('/plots', { projectId: 'p1' })
  })

  it('getById should call GET /plots/:id', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: {} })
    await plotService.getById('pl1')
    expect(mockApi.get).toHaveBeenCalledWith('/plots/pl1')
  })

  it('getPendingApproval should call GET /plots/:id/pending-approval', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: {} })
    await plotService.getPendingApproval('pl1')
    expect(mockApi.get).toHaveBeenCalledWith('/plots/pl1/pending-approval')
  })

  it('getByProject should call GET /plots with projectId and limit', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await plotService.getByProject('proj1')
    expect(mockApi.get).toHaveBeenCalledWith('/plots', { projectId: 'proj1', limit: 500 })
  })

  it('getByStatus should call GET /plots/status/:status', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await plotService.getByStatus('Available', { page: 1 })
    expect(mockApi.get).toHaveBeenCalledWith('/plots/status/Available', { page: 1 })
  })

  it('create should call POST /plots', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: 'new' } })
    await plotService.create({ plotNumber: 'A1', projectId: 'p1' })
    expect(mockApi.post).toHaveBeenCalledWith('/plots', { plotNumber: 'A1', projectId: 'p1' })
  })

  it('update should call PUT /plots/:id', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await plotService.update('pl1', { facing: 'North' })
    expect(mockApi.put).toHaveBeenCalledWith('/plots/pl1', { facing: 'North' })
  })

  it('bookPlot should call PUT /plots/:id/book with booking data', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await plotService.bookPlot('pl1', { customerName: 'John', phone: '123', paymentStatus: 'Not Paid' })
    expect(mockApi.put).toHaveBeenCalledWith('/plots/pl1/book', { customerName: 'John', phone: '123', paymentStatus: 'Not Paid' })
  })

  it('approveBooking should call PUT /plots/:id/approve', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await plotService.approveBooking('pl1')
    expect(mockApi.put).toHaveBeenCalledWith('/plots/pl1/approve')
  })

  it('rejectBooking should call PUT /plots/:id/reject', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await plotService.rejectBooking('pl1')
    expect(mockApi.put).toHaveBeenCalledWith('/plots/pl1/reject')
  })

  it('getPendingApprovals should call GET /plots/pending-approvals', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await plotService.getPendingApprovals()
    expect(mockApi.get).toHaveBeenCalledWith('/plots/pending-approvals')
  })

  it('delete should call DELETE /plots/:id', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await plotService.delete('pl1')
    expect(mockApi.delete).toHaveBeenCalledWith('/plots/pl1')
  })

  it('getMyBookings should call GET /plots/my-bookings with params', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [], total: 0 })
    await plotService.getMyBookings({ page: 1, limit: 10 })
    expect(mockApi.get).toHaveBeenCalledWith('/plots/my-bookings', { page: 1, limit: 10 })
  })

  it('getMyBookings should call GET /plots/my-bookings without params', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [], total: 0 })
    await plotService.getMyBookings()
    expect(mockApi.get).toHaveBeenCalledWith('/plots/my-bookings', undefined)
  })

  it('registerPlot should call PUT /plots/:id/register with data', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await plotService.registerPlot('pl1', { registrationDate: '2026-07-21', paymentStatus: 'Fully Paid' })
    expect(mockApi.put).toHaveBeenCalledWith('/plots/pl1/register', { registrationDate: '2026-07-21', paymentStatus: 'Fully Paid' })
  })
})
