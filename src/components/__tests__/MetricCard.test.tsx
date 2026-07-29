import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MetricCard } from '@/components/shared/MetricCard'

describe('MetricCard', () => {
  it('should render title and value', () => {
    render(<MetricCard title="Total Leads" value={42} icon={<span>📊</span>} color="blue" />)
    expect(screen.getByText('Total Leads')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('should render string value', () => {
    render(<MetricCard title="Revenue" value="₹12L" icon={<span>💰</span>} color="green" />)
    expect(screen.getByText('₹12L')).toBeInTheDocument()
  })

  it('should apply blue border color', () => {
    const { container } = render(<MetricCard title="Test" value={0} icon={<span>🔵</span>} color="blue" />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('border-l-blue-600')
  })

  it('should apply green border color', () => {
    const { container } = render(<MetricCard title="Test" value={0} icon={<span>🟢</span>} color="green" />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('border-l-green-500')
  })

  it('should apply amber border color', () => {
    const { container } = render(<MetricCard title="Test" value={0} icon={<span>🟡</span>} color="amber" />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('border-l-amber-500')
  })

  it('should render icon in icon container', () => {
    render(<MetricCard title="Test" value={0} icon={<span data-testid="icon">📊</span>} color="blue" />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
