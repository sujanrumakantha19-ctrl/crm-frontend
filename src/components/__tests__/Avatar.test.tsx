import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Avatar } from '@/components/shared/Avatar'

describe('Avatar', () => {
  it('should render initials', () => {
    render(<Avatar initials="AB" />)
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('should apply md size by default', () => {
    render(<Avatar initials="AB" />)
    const avatar = screen.getByText('AB')
    expect(avatar.className).toContain('w-9')
    expect(avatar.className).toContain('h-9')
  })

  it('should apply sm size', () => {
    render(<Avatar initials="AB" size="sm" />)
    const avatar = screen.getByText('AB')
    expect(avatar.className).toContain('w-6')
    expect(avatar.className).toContain('h-6')
  })

  it('should apply lg size', () => {
    render(<Avatar initials="AB" size="lg" />)
    const avatar = screen.getByText('AB')
    expect(avatar.className).toContain('w-14')
    expect(avatar.className).toContain('h-14')
  })

  it('should apply xl size', () => {
    render(<Avatar initials="AB" size="xl" />)
    const avatar = screen.getByText('AB')
    expect(avatar.className).toContain('w-24')
    expect(avatar.className).toContain('h-24')
  })

  it('should apply default blue background', () => {
    render(<Avatar initials="AB" />)
    const avatar = screen.getByText('AB')
    expect(avatar.className).toContain('bg-blue-500')
  })

  it('should apply custom background', () => {
    render(<Avatar initials="AB" bg="bg-red-500" />)
    const avatar = screen.getByText('AB')
    expect(avatar.className).toContain('bg-red-500')
  })

  it('should render image when src is provided', () => {
    render(<Avatar initials="AB" src="https://example.com/photo.jpg" />)
    const img = screen.getByAltText('avatar')
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toBe('https://example.com/photo.jpg')
  })

  it('should not render initials when src is provided', () => {
    render(<Avatar initials="AB" src="https://example.com/photo.jpg" />)
    expect(screen.queryByText('AB')).not.toBeInTheDocument()
  })

  it('should accept custom className', () => {
    render(<Avatar initials="AB" className="my-class" />)
    const avatar = screen.getByText('AB')
    expect(avatar.className).toContain('my-class')
  })
})
