import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Modal } from '@/components/shared/Modal'

describe('Modal', () => {
  it('should render children when open', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    )
    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    )
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
  })

  it('should render title when provided', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test Title">
        <p>Content</p>
      </Modal>
    )
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('should not render title header when title is not provided', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <p>Content</p>
      </Modal>
    )
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose} title="Closeable">
        <p>Content</p>
      </Modal>
    )
    const closeBtn = screen.getByRole('button')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should render footer when provided', () => {
    render(
      <Modal open={true} onClose={() => {}} footer={<button>Save</button>}>
        <p>Content</p>
      </Modal>
    )
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('should apply size classes', () => {
    render(
      <Modal open={true} onClose={() => {}} size="lg">
        <p>Content</p>
      </Modal>
    )
    // Modal uses createPortal to document.body, so query there
    const dialog = document.body.querySelector('[class*="max-w"]')
    expect(dialog).toBeInTheDocument()
    expect(dialog!.className).toContain('max-w')
  })
})
