import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '@/pages/Home'

describe('Home Page', () => {
  it('should render the heading', () => {
    render(<Home />)
    expect(screen.getByText('Vite + React')).toBeInTheDocument()
  })

  it('should render the counter button with initial count 0', () => {
    render(<Home />)
    expect(screen.getByText('count is 0')).toBeInTheDocument()
  })

  it('should render the edit hint text', () => {
    render(<Home />)
    expect(screen.getByText(/Edit/)).toBeInTheDocument()
    expect(screen.getByText('src/App.tsx')).toBeInTheDocument()
  })
})
