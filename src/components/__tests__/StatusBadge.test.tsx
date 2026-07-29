import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge } from '@/components/shared/StatusBadge'

describe('StatusBadge', () => {
  it('should render the status text', () => {
    render(<StatusBadge status="Active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('should apply correct colors for Active status', () => {
    render(<StatusBadge status="Active" />)
    const badge = screen.getByText('Active')
    expect(badge.className).toContain('bg-green-100')
    expect(badge.className).toContain('text-green-700')
  })

  it('should apply correct colors for Open status', () => {
    render(<StatusBadge status="Open" />)
    const badge = screen.getByText('Open')
    expect(badge.className).toContain('bg-blue-100')
    expect(badge.className).toContain('text-blue-700')
  })

  it('should apply correct colors for Pending status', () => {
    render(<StatusBadge status="Pending" />)
    const badge = screen.getByText('Pending')
    expect(badge.className).toContain('bg-amber-100')
    expect(badge.className).toContain('text-amber-700')
  })

  it('should apply correct colors for Done status', () => {
    render(<StatusBadge status="Done" />)
    const badge = screen.getByText('Done')
    expect(badge.className).toContain('bg-green-100')
    expect(badge.className).toContain('text-green-700')
  })

  it('should apply default colors for unknown status', () => {
    render(<StatusBadge status="Unknown" />)
    const badge = screen.getByText('Unknown')
    expect(badge.className).toContain('bg-gray-100')
    expect(badge.className).toContain('text-gray-600')
  })

  it('should apply sm size by default', () => {
    render(<StatusBadge status="Active" />)
    const badge = screen.getByText('Active')
    expect(badge.className).toContain('text-xs')
  })

  it('should apply md size when specified', () => {
    render(<StatusBadge status="Active" size="md" />)
    const badge = screen.getByText('Active')
    expect(badge.className).toContain('text-sm')
  })

  it('should accept custom className', () => {
    render(<StatusBadge status="Active" className="my-custom-class" />)
    const badge = screen.getByText('Active')
    expect(badge.className).toContain('my-custom-class')
  })
})
