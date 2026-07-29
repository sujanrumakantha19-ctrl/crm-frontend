import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, afterAll } from 'vitest'

// ─── Suppress harmless console warnings in tests ──────────────────
// Silences React act() warnings, Recharts SVG casing warnings,
// and other noisy but non-actionable console output.
const originalWarn = console.warn
const originalError = console.error

beforeAll(() => {
  console.warn = (...args: any[]) => {
    const msg = args[0]
    if (
      typeof msg === 'string' && (
        msg.includes('act(') ||
        msg.includes('Warning:') ||
        msg.includes('not wrapped in act') ||
        msg.includes('using incorrect casing') ||
        msg.includes('React does not recognize')
      )
    ) return
    originalWarn(...args)
  }
  console.error = (...args: any[]) => {
    const msg = args[0]
    if (
      typeof msg === 'string' && (
        msg.includes('act(') ||
        msg.includes('not wrapped in act') ||
        msg.includes('using incorrect casing')
      )
    ) return
    originalError(...args)
  }
})

afterAll(() => {
  console.warn = originalWarn
  console.error = originalError
})


// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] || null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = () => {}
  unobserve = () => {}
  disconnect = () => {}
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
})

// Clean up after each test
afterEach(() => {
  localStorageMock.clear()
  document.body.innerHTML = ''
})
