import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getFileUrl, UPLOADS_BASE, api } from '@/lib/api'

// ─── Mock fetch globally ────────────────────────────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Mock localStorage ──────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string): string | null => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _reset() { store = {} },
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

// ─── Mock window.location ──────────────────────────────────────────
const originalLocation = window.location
let mockHref = ''

beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock._reset()
  mockHref = ''
  Object.defineProperty(window, 'location', {
    value: {
      ...originalLocation,
      get href() { return mockHref },
      set href(val: string) { mockHref = val },
    },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  })
})

// ─── Helper: create mock Response ──────────────────────────────────
function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response
}

// ═══════════════════════════════════════════════════════════════════
// getFileUrl & UPLOADS_BASE
// ═══════════════════════════════════════════════════════════════════
describe('getFileUrl', () => {
  it('should return empty string for undefined', () => {
    expect(getFileUrl(undefined)).toBe('')
  })

  it('should return empty string for empty string', () => {
    expect(getFileUrl('')).toBe('')
  })

  it('should return http URLs as-is', () => {
    const url = 'http://example.com/image.jpg'
    expect(getFileUrl(url)).toBe(url)
  })

  it('should return https URLs as-is', () => {
    const url = 'https://example.com/image.jpg'
    expect(getFileUrl(url)).toBe(url)
  })

  it('should format /uploads/ category paths', () => {
    const result = getFileUrl('/uploads/general/photo.jpg')
    expect(result).toContain('/uploads/file/general/photo.jpg')
  })

  it('should handle relative paths without leading slash', () => {
    const result = getFileUrl('uploads/general/photo.jpg')
    expect(result).toContain('/uploads/file/general/photo.jpg')
  })
})

describe('UPLOADS_BASE', () => {
  it('should be defined and a string', () => {
    expect(UPLOADS_BASE).toBeDefined()
    expect(typeof UPLOADS_BASE).toBe('string')
  })

  it('should not contain /api/v1', () => {
    expect(UPLOADS_BASE).not.toContain('/api/v1')
  })
})

// ═══════════════════════════════════════════════════════════════════
// ApiClient — Token Management
// ═══════════════════════════════════════════════════════════════════
describe('ApiClient — Token Management', () => {
  beforeEach(() => {
    localStorageMock._reset()
  })

  it('setToken should store token in localStorage', () => {
    api.setToken('my-jwt-token')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('crm_token', 'my-jwt-token')
  })

  it('clearToken should remove token from localStorage', () => {
    api.clearToken()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_token')
  })
})

// ═══════════════════════════════════════════════════════════════════
// ApiClient — GET requests
// ═══════════════════════════════════════════════════════════════════
describe('ApiClient — GET', () => {
  beforeEach(() => {
    localStorageMock._reset()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should make a GET request to the correct URL', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { id: '1' } }))

    const result = await api.get('/leads')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/leads')
    expect(opts.method).toBe('GET')
    expect(opts.headers).toHaveProperty('Content-Type', 'application/json')
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: '1' })
  })

  it('should append query params to URL', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: [] }))

    await api.get('/leads', { status: 'Open', page: 1 })

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('status=Open')
    expect(url).toContain('page=1')
  })

  it('should skip undefined and empty string params', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: [] }))

    await api.get('/leads', { status: 'Open', search: undefined, page: '' })

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('status=Open')
    expect(url).not.toContain('search=')
    expect(url).not.toContain('page=')
  })

  it('should include Authorization header when token exists', async () => {
    localStorageMock.getItem.mockReturnValue('test-token')
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: {} }))

    await api.get('/leads')

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers).toHaveProperty('Authorization', 'Bearer test-token')
  })

  it('should not include Authorization header when no token', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: {} }))

    await api.get('/leads')

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers).not.toHaveProperty('Authorization')
  })
})

// ═══════════════════════════════════════════════════════════════════
// ApiClient — POST requests
// ═══════════════════════════════════════════════════════════════════
describe('ApiClient — POST', () => {
  beforeEach(() => {
    localStorageMock._reset()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should make a POST request with JSON body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { id: 'new' } }))

    const result = await api.post('/leads', { customerName: 'Test' })

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/leads')
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe(JSON.stringify({ customerName: 'Test' }))
    expect(result.data).toEqual({ id: 'new' })
  })

  it('should send POST without body when none provided', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: {} }))

    await api.post('/auth/logout')

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('POST')
    expect(opts.body).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════
// ApiClient — PUT requests
// ═══════════════════════════════════════════════════════════════════
describe('ApiClient — PUT', () => {
  beforeEach(() => {
    localStorageMock._reset()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should make a PUT request with JSON body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { name: 'Updated' } }))

    const result = await api.put('/leads/1', { name: 'Updated' })

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/leads/1')
    expect(opts.method).toBe('PUT')
    expect(opts.body).toBe(JSON.stringify({ name: 'Updated' }))
    expect(result.data).toEqual({ name: 'Updated' })
  })
})

// ═══════════════════════════════════════════════════════════════════
// ApiClient — DELETE requests
// ═══════════════════════════════════════════════════════════════════
describe('ApiClient — DELETE', () => {
  beforeEach(() => {
    localStorageMock._reset()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should make a DELETE request', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: {} }))

    const result = await api.delete('/leads/1')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/leads/1')
    expect(opts.method).toBe('DELETE')
    expect(result.success).toBe(true)
  })

  it('should send DELETE with body when provided', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: {} }))

    await api.delete('/auth/push-token', { token: 'push-123' })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('DELETE')
    expect(opts.body).toBe(JSON.stringify({ token: 'push-123' }))
  })
})

// ═══════════════════════════════════════════════════════════════════
// ApiClient — upload
// ═══════════════════════════════════════════════════════════════════
describe('ApiClient — upload', () => {
  beforeEach(() => {
    localStorageMock._reset()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should upload FormData via POST without Content-Type (browser sets it)', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { url: '/uploads/file.pdf' } }))

    const formData = new FormData()
    formData.append('file', new File(['test'], 'test.pdf'))

    const result = await api.upload('/uploads', formData)

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/uploads')
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe(formData)
    // Browser automatically sets Content-Type with boundary for FormData
    expect(opts.headers).not.toHaveProperty('Content-Type')
    expect(result.data).toEqual({ url: '/uploads/file.pdf' })
  })

  it('should include Authorization header when token exists', async () => {
    localStorageMock.getItem.mockReturnValue('upload-token')
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: {} }))

    const formData = new FormData()
    await api.upload('/uploads', formData)

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers).toHaveProperty('Authorization', 'Bearer upload-token')
  })

  it('should not include Authorization header when no token', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: {} }))

    const formData = new FormData()
    await api.upload('/uploads', formData)

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers).not.toHaveProperty('Authorization')
  })
})

// ═══════════════════════════════════════════════════════════════════
// ApiClient — Error Handling
// ═══════════════════════════════════════════════════════════════════
describe('ApiClient — Error Handling', () => {
  beforeEach(() => {
    localStorageMock._reset()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should propagate network errors from fetch', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(api.get('/leads')).rejects.toThrow('Network error')
  })

  it('should throw error when response is not ok', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false, error: 'Lead not found' }, false, 404)
    )

    await expect(api.get('/leads/nonexistent')).rejects.toThrow('Lead not found')
  })

  it('should throw generic error when response has no error message', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false }, false, 500)
    )

    await expect(api.get('/leads')).rejects.toThrow('Request failed')
  })

  it('should throw error on upload failure', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false, error: 'File too large' }, false, 413)
    )

    const formData = new FormData()
    await expect(api.upload('/uploads', formData)).rejects.toThrow('File too large')
  })

  it('should throw generic error on upload failure without error message', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false }, false, 500)
    )

    const formData = new FormData()
    await expect(api.upload('/uploads', formData)).rejects.toThrow('Upload failed')
  })
})

// ═══════════════════════════════════════════════════════════════════
// ApiClient — 401 Unauthorized Handling
// ═══════════════════════════════════════════════════════════════════
describe('ApiClient — 401 Unauthorized', () => {
  beforeEach(() => {
    localStorageMock._reset()
    localStorageMock.getItem.mockReturnValue('expired-token')
    localStorageMock.setItem('crm_role', 'admin')
    localStorageMock.setItem('crm_user', '{"name":"Admin"}')
  })

  it('should clear token and redirect to /login on 401', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false, error: 'Unauthorized' }, false, 401)
    )

    await expect(api.get('/leads')).rejects.toThrow('Unauthorized')

    // Token should be cleared
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_token')
    // Role and user should be cleared
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_role')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_user')
    // Should redirect to login
    expect(mockHref).toBe('/login')
  })

  it('should handle 401 on POST request', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false }, false, 401)
    )

    await expect(api.post('/leads', { name: 'Test' })).rejects.toThrow('Unauthorized')

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_token')
    expect(mockHref).toBe('/login')
  })

  it('should handle 401 on PUT request', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false }, false, 401)
    )

    await expect(api.put('/leads/1', { name: 'Test' })).rejects.toThrow('Unauthorized')

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_token')
    expect(mockHref).toBe('/login')
  })

  it('should handle 401 on DELETE request', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false }, false, 401)
    )

    await expect(api.delete('/leads/1')).rejects.toThrow('Unauthorized')

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_token')
    expect(mockHref).toBe('/login')
  })

  it('should handle 401 on upload request', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false }, false, 401)
    )

    const formData = new FormData()
    await expect(api.upload('/uploads', formData)).rejects.toThrow('Unauthorized')

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_token')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_role')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_user')
    expect(mockHref).toBe('/login')
  })

  it('should clear all three localStorage keys on 401', async () => {
    localStorageMock.setItem('crm_token', 'expired')
    localStorageMock.setItem('crm_role', 'admin')
    localStorageMock.setItem('crm_user', '{"name":"Admin"}')

    mockFetch.mockResolvedValue(
      jsonResponse({ success: false }, false, 401)
    )

    await expect(api.get('/leads')).rejects.toThrow('Unauthorized')

    expect(localStorageMock.removeItem).toHaveBeenCalledTimes(3)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_token')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_role')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('crm_user')
  })
})

// ═══════════════════════════════════════════════════════════════════
// ApiClient — Request Options
// ═══════════════════════════════════════════════════════════════════
describe('ApiClient — Request Options', () => {
  beforeEach(() => {
    localStorageMock._reset()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should set Content-Type to application/json for all requests', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: {} }))

    await api.get('/leads')

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers).toHaveProperty('Content-Type', 'application/json')
  })

  it('should use full URL with baseUrl prefix', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: {} }))

    await api.get('/leads')

    const [url] = mockFetch.mock.calls[0]
    expect(url).toMatch(/^https?:\/\/.+\/api\/v1\/leads/)
  })

  it('should handle numeric query params', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: [] }))

    await api.get('/leads', { page: 2, limit: 25 })

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('page=2')
    expect(url).toContain('limit=25')
  })
})
