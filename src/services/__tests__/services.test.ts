import { describe, it, expect, vi, beforeEach } from 'vitest'
import { leadService } from '@/services/leads'
import { projectService } from '@/services/projects'
import { taskService } from '@/services/tasks'

vi.mock('@/lib/api', () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn(),
  }
  return { api: mockApi, UPLOADS_BASE: 'http://localhost:3001' }
})

import { api } from '@/lib/api'
const mockApi = vi.mocked(api)

describe('leadService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll should call GET /leads with params', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await leadService.getAll({ status: 'Open', page: 1 })
    expect(mockApi.get).toHaveBeenCalledWith('/leads', { status: 'Open', page: 1 })
  })

  it('getById should call GET /leads/:id', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: { id: '1' } })
    await leadService.getById('1')
    expect(mockApi.get).toHaveBeenCalledWith('/leads/1')
  })

  it('getByStatus should call GET /leads/status/:status', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await leadService.getByStatus('Qualified')
    expect(mockApi.get).toHaveBeenCalledWith('/leads/status/Qualified')
  })

  it('getByUser should call GET /leads/user/:userId', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await leadService.getByUser('user1')
    expect(mockApi.get).toHaveBeenCalledWith('/leads/user/user1')
  })

  it('getByProject should call GET /leads/project/:projectId', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await leadService.getByProject('proj1')
    expect(mockApi.get).toHaveBeenCalledWith('/leads/project/proj1')
  })

  it('create should call POST /leads', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: 'new' } })
    await leadService.create({ customerName: 'Test', phone: '123' })
    expect(mockApi.post).toHaveBeenCalledWith('/leads', { customerName: 'Test', phone: '123' })
  })

  it('update should call PUT /leads/:id', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: { id: '1' } })
    await leadService.update('1', { status: 'Qualified' })
    expect(mockApi.put).toHaveBeenCalledWith('/leads/1', { status: 'Qualified' })
  })

  it('delete should call DELETE /leads/:id', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await leadService.delete('1')
    expect(mockApi.delete).toHaveBeenCalledWith('/leads/1')
  })
})

describe('projectService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll should call GET /projects with params', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await projectService.getAll({ status: 'Active' })
    expect(mockApi.get).toHaveBeenCalledWith('/projects', { status: 'Active' })
  })

  it('getById should call GET /projects/:id', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: {} })
    await projectService.getById('proj1')
    expect(mockApi.get).toHaveBeenCalledWith('/projects/proj1')
  })

  it('create should call POST /projects', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: 'new' } })
    await projectService.create({ name: 'New Project', location: 'Hyd' })
    expect(mockApi.post).toHaveBeenCalledWith('/projects', { name: 'New Project', location: 'Hyd' })
  })

  it('update should call PUT /projects/:id', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await projectService.update('p1', { name: 'Updated' })
    expect(mockApi.put).toHaveBeenCalledWith('/projects/p1', { name: 'Updated' })
  })

  it('delete should call DELETE /projects/:id', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await projectService.delete('p1')
    expect(mockApi.delete).toHaveBeenCalledWith('/projects/p1')
  })

  it('getLocations should call GET /projects/locations', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: ['Hyd', 'Bangalore'] })
    const res = await projectService.getLocations()
    expect(mockApi.get).toHaveBeenCalledWith('/projects/locations')
    expect(res.data).toEqual(['Hyd', 'Bangalore'])
  })
})

describe('taskService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll should call GET /tasks', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await taskService.getAll({ status: 'Done' })
    expect(mockApi.get).toHaveBeenCalledWith('/tasks', { status: 'Done' })
  })

  it('getById should call GET /tasks/:id', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: {} })
    await taskService.getById('t1')
    expect(mockApi.get).toHaveBeenCalledWith('/tasks/t1')
  })

  it('getByAssignee should call GET /tasks/assignee/:assigneeId', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await taskService.getByAssignee('u1')
    expect(mockApi.get).toHaveBeenCalledWith('/tasks/assignee/u1')
  })

  it('getByStatus should call GET /tasks/status/:status', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await taskService.getByStatus('Done')
    expect(mockApi.get).toHaveBeenCalledWith('/tasks/status/Done')
  })

  it('getByProject should call GET /tasks/project/:projectId', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] })
    await taskService.getByProject('proj1')
    expect(mockApi.get).toHaveBeenCalledWith('/tasks/project/proj1')
  })

  it('create should call POST /tasks', async () => {
    mockApi.post.mockResolvedValue({ success: true, data: { id: 'new' } })
    await taskService.create({ title: 'New Task' })
    expect(mockApi.post).toHaveBeenCalledWith('/tasks', { title: 'New Task' })
  })

  it('update should call PUT /tasks/:id', async () => {
    mockApi.put.mockResolvedValue({ success: true, data: {} })
    await taskService.update('t1', { status: 'Done' })
    expect(mockApi.put).toHaveBeenCalledWith('/tasks/t1', { status: 'Done' })
  })

  it('delete should call DELETE /tasks/:id', async () => {
    mockApi.delete.mockResolvedValue({ success: true, data: {} })
    await taskService.delete('t1')
    expect(mockApi.delete).toHaveBeenCalledWith('/tasks/t1')
  })
})
