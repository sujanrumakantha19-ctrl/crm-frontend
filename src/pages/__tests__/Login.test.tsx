import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '@/pages/Login'

// ─── Mock useNavigate ─────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ─── Mock AuthContext ──────────────────────────────────────────────
const mockLogin = vi.fn()
let mockIsAuthenticated = false
let mockRole: string | null = null
let mockAuthLoading = false

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: mockIsAuthenticated,
    role: mockRole,
    loading: mockAuthLoading,
  }),
}))

// ─── Tests ────────────────────────────────────────────────────────
describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthenticated = false
    mockRole = null
    mockAuthLoading = false
  })

  const renderLogin = () =>
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

  it('should render the login form', () => {
    renderLogin()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign In/ })).toBeInTheDocument()
  })

  it('should render the forgot password link', () => {
    renderLogin()
    expect(screen.getByText('Forgot password?')).toBeInTheDocument()
  })

  it('should show error when submitting empty form', async () => {
    renderLogin()
    const submitButton = screen.getByRole('button', { name: /Sign In/ })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Please enter email and password')).toBeInTheDocument()
    })

    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('should call login with email and password on submit', async () => {
    mockLogin.mockResolvedValue(undefined)
    renderLogin()

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'admin@test.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/ }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@test.com', 'password123')
    })
  })

  it('should display error message when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'))
    renderLogin()

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'admin@test.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'wrongpassword' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/ }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('should toggle password visibility', () => {
    renderLogin()
    const passwordInput = screen.getByPlaceholderText('Enter your password')
    expect(passwordInput).toHaveAttribute('type', 'password')

    // Click the eye icon toggle
    const toggleButton = passwordInput.parentElement!.querySelector('button')!
    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')

    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('should disable submit button while logging in', async () => {
    // Make login never resolve to keep loading state
    mockLogin.mockReturnValue(new Promise(() => {}))
    renderLogin()

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'admin@test.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/ }))

    await waitFor(() => {
      // The submit button should be disabled when loading (text changes to spinner)
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      expect(submitBtn).toBeDisabled()
    })
  })

  it('should navigate to role dashboard when already authenticated', () => {
    mockIsAuthenticated = true
    mockRole = 'admin'
    renderLogin()

    // Should navigate to admin dashboard
    expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard')
  })

  it('should render the brand name on mobile', () => {
    renderLogin()
    expect(screen.getByText('Samy & Co land promoters')).toBeInTheDocument()
  })

  it('should have email input with correct type', () => {
    renderLogin()
    const emailInput = screen.getByPlaceholderText('you@example.com')
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autoComplete', 'email')
  })

  it('should have password input with correct autoComplete', () => {
    renderLogin()
    const passwordInput = screen.getByPlaceholderText('Enter your password')
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
  })
})
