import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import PartnerDashboard from '@/pages/partner/Dashboard'
import { leadService, projectService, plotService } from '@/services'

// ─── Mock services ────────────────────────────────────────────────
vi.mock('@/services', () => ({
  leadService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  projectService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  plotService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}))

// ─── Mock AuthContext ──────────────────────────────────────────────
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'partner1', name: 'Ravi Partner', role: 'partner' },
    userId: 'partner1',
    role: 'partner',
    isAuthenticated: true,
    loading: false,
  }),
}))

// ─── Mock useNavigate ─────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ─── Mock Recharts ────────────────────────────────────────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

// ─── Mock shared components ───────────────────────────────────────
vi.mock('@/components/shared/StatusBadge', () => ({
  StatusBadge: ({ status }: any) => <span data-testid="status-badge">{status}</span>,
}))

// ─── Helper: set mock data for services ───────────────────────────
function mockServiceData(projects: any[], leads: any[]) {
  vi.mocked(projectService.getAll).mockResolvedValue({ data: projects } as any)
  vi.mocked(leadService.getAll).mockResolvedValue({ data: leads } as any)
  vi.mocked(plotService.getAll).mockResolvedValue({ data: [] } as any)
}

// ─── Tests ────────────────────────────────────────────────────────
describe('Partner Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(leadService.getAll).mockResolvedValue({ data: [] } as any)
    vi.mocked(projectService.getAll).mockResolvedValue({ data: [] } as any)
    vi.mocked(plotService.getAll).mockResolvedValue({ data: [] } as any)
  })

  it('should show loading skeleton initially', () => {
    render(<PartnerDashboard />)
    expect(document.querySelector('.animate-pulse') || document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('should render metric cards after loading', async () => {
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Leads Submitted')).toBeInTheDocument()
    })

    expect(screen.getByText('Leads Converted')).toBeInTheDocument()
    expect(screen.getByText('Plots Booked')).toBeInTheDocument()
  })

  it('should render chart sections after loading', async () => {
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Leads Submitted Trend')).toBeInTheDocument()
    })

    expect(screen.getByText('My Leads Status')).toBeInTheDocument()
  })

  it('should render projects section after loading', async () => {
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Available Projects')).toBeInTheDocument()
    })

    expect(screen.getByText('View projects to access open leads')).toBeInTheDocument()
  })

  it('should render recent leads section after loading', async () => {
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('My Recent Leads')).toBeInTheDocument()
    })
  })

  it('should show empty state when no projects', async () => {
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Available Projects')).toBeInTheDocument()
    })

    // Text appears in both mobile (p) and desktop (td) views
    const emptyProjects = screen.getAllByText('No available projects found')
    expect(emptyProjects.length).toBeGreaterThanOrEqual(1)
  })

  it('should show empty state when no leads', async () => {
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('My Recent Leads')).toBeInTheDocument()
    })

    // Text appears in both mobile (p) and desktop (td) views
    const emptyLeads = screen.getAllByText('No submitted leads found')
    expect(emptyLeads.length).toBeGreaterThanOrEqual(1)
  })

  it('should display zero counts when no data', async () => {
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Leads Submitted')).toBeInTheDocument()
    })

    // All metric counts should be 0
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(3)
  })

  it('should render table headers for projects', async () => {
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Project Name')).toBeInTheDocument()
    })

    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Total Plots')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('should render table headers for leads', async () => {
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Customer Name')).toBeInTheDocument()
    })

    expect(screen.getByText('Phone')).toBeInTheDocument()
    expect(screen.getByText('Date Submitted')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })
})

// ─── Pagination Tests ─────────────────────────────────────────────
describe('Partner Dashboard — Pagination', () => {
  const mockProjects = Array.from({ length: 7 }, (_, i) => ({
    id: `proj${i + 1}`,
    name: `Project ${i + 1}`,
    location: 'Hyderabad',
    totalPlots: 20,
    isEnabled: true,
  }))

  const mockLeads = Array.from({ length: 12 }, (_, i) => ({
    id: `lead${i + 1}`,
    customerName: `Customer ${i + 1}`,
    phone: `90000000${String(i).padStart(2, '0')}`,
    status: 'Open' as const,
    source: 'Ravi Partner',
    dateAdded: '2024-01-15',
  }))

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: return empty data, individual tests override
    vi.mocked(leadService.getAll).mockResolvedValue({ data: [] } as any)
    vi.mocked(projectService.getAll).mockResolvedValue({ data: [] } as any)
    vi.mocked(plotService.getAll).mockResolvedValue({ data: [] } as any)
  })

  it('should show pagination when projects exceed 5 items', async () => {
    mockServiceData(mockProjects, [])
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Available Projects')).toBeInTheDocument()
    })

    // Should show page 1 of 2 (7 projects / 5 per page)
    await waitFor(() => {
      expect(screen.getAllByText('1 / 2').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('should show project count in pagination text', async () => {
    mockServiceData(mockProjects, [])
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getAllByText('1 / 2').length).toBeGreaterThanOrEqual(1)
    })

    // Desktop table should show the total count somewhere
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('should show pagination when leads exceed 5 items', async () => {
    mockServiceData([], mockLeads)
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('My Recent Leads')).toBeInTheDocument()
    })

    // Should show leads pagination (12 leads / 5 per page = 3 pages)
    const paginationTexts = screen.getAllByText(/\d+ \/ \d+/)
    expect(paginationTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('should disable Prev button on first page', async () => {
    mockServiceData(mockProjects, [])
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Available Projects')).toBeInTheDocument()
    })

    // First Prev button (projects desktop) should be disabled
    const prevButtons = screen.getAllByText('Prev')
    expect(prevButtons[0]).toBeDisabled()
  })

  it('should navigate to page 2 when clicking Next', async () => {
    mockServiceData(mockProjects, [])
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getAllByText('1 / 2').length).toBeGreaterThanOrEqual(1)
    })

    // Click Next on desktop pagination (last Next button)
    const nextButtons = screen.getAllByText('Next')
    fireEvent.click(nextButtons[nextButtons.length - 1])

    await waitFor(() => {
      expect(screen.getAllByText('2 / 2').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('should show page number buttons for projects', async () => {
    mockServiceData(mockProjects, [])
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Available Projects')).toBeInTheDocument()
    })

    // Should show page number buttons 1 and 2
    const pageButtons = screen.getAllByRole('button').filter(
      btn => btn.textContent === '1' || btn.textContent === '2'
    )
    expect(pageButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('should display correct project data in table', async () => {
    mockServiceData(mockProjects, [])
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getAllByText('Project 1').length).toBeGreaterThanOrEqual(1)
    })

    // Project names appear in both mobile and desktop views
    expect(screen.getAllByText('Project 2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Hyderabad').length).toBeGreaterThanOrEqual(1)
  })

  it('should navigate to add-lead when clicking Add Lead', async () => {
    mockServiceData(mockProjects.slice(0, 2), [])
    render(<PartnerDashboard />)

    await waitFor(() => {
      expect(screen.getAllByText('Add Lead').length).toBeGreaterThanOrEqual(1)
    })

    const addLeadButtons = screen.getAllByText('Add Lead')
    fireEvent.click(addLeadButtons[0])

    expect(mockNavigate).toHaveBeenCalledWith('/partner/add-lead?projectId=proj1')
  })
})
