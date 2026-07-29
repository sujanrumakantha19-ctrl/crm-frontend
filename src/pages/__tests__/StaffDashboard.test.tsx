import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import StaffDashboard from '@/pages/staff/Dashboard'
import { leadService, taskService, activityLogService } from '@/services'

// ─── Mock services ────────────────────────────────────────────────
vi.mock('@/services', () => ({
  leadService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  taskService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  activityLogService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}))

// ─── Mock AuthContext ──────────────────────────────────────────────
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    userId: 'staff1',
    user: { id: 'staff1', name: 'Priya Sharma', role: 'staff' },
    role: 'staff',
    isAuthenticated: true,
    loading: false,
  }),
}))

// ─── Mock taskAssignee ────────────────────────────────────────────
vi.mock('@/lib/taskAssignee', () => ({
  isTaskAssignedTo: (assignee: any, userId: string, _name: string) => {
    if (!assignee) return false
    const id = typeof assignee === 'string' ? assignee : assignee?._id || assignee?.id
    return id === userId
  },
}))

// ─── Mock Recharts ────────────────────────────────────────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  Cell: () => null,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

// ─── Mock shared components ───────────────────────────────────────
vi.mock('@/components/shared/Timeline', () => ({
  Timeline: ({ items }: any) => (
    <div data-testid="timeline">
      {items.length === 0 ? <p>No activity yet</p> : items.map((item: any) => <div key={item.id}>{item.label}</div>)}
    </div>
  ),
}))

vi.mock('@/components/shared/StatusBadge', () => ({
  StatusBadge: ({ status }: any) => <span data-testid="status-badge">{status}</span>,
}))

// ─── Helper: set mock data for services ───────────────────────────
function mockServiceData(leads: any[], tasks: any[], activities: any[]) {
  vi.mocked(leadService.getAll).mockResolvedValue({ data: leads } as any)
  vi.mocked(taskService.getAll).mockResolvedValue({ data: tasks } as any)
  vi.mocked(activityLogService.getAll).mockResolvedValue({ data: activities } as any)
}

// ─── Tests ────────────────────────────────────────────────────────
describe('Staff Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(leadService.getAll).mockResolvedValue({ data: [] } as any)
    vi.mocked(taskService.getAll).mockResolvedValue({ data: [] } as any)
    vi.mocked(activityLogService.getAll).mockResolvedValue({ data: [] } as any)
  })

  it('should show loading skeleton initially', () => {
    render(<StaffDashboard />)
    expect(document.querySelector('.animate-pulse') || document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('should render welcome banner after loading', async () => {
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Good morning, Priya/)).toBeInTheDocument()
    })

    expect(screen.getByText('Welcome back to your workspace')).toBeInTheDocument()
  })

  it('should render metric cards after loading', async () => {
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Leads Assigned')).toBeInTheDocument()
    })

    expect(screen.getByText('Tasks Pending')).toBeInTheDocument()
    expect(screen.getByText('Active Leads')).toBeInTheDocument()
  })

  it('should render chart sections after loading', async () => {
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Leads Pipeline Stage')).toBeInTheDocument()
    })

    expect(screen.getByText('Weekly Tasks Performance')).toBeInTheDocument()
    expect(screen.getByText('Total assigned leads at each stage')).toBeInTheDocument()
    expect(screen.getByText('Completed vs assigned tasks this week')).toBeInTheDocument()
  })

  it('should render follow-ups section after loading', async () => {
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText("Today's Follow-ups")).toBeInTheDocument()
    })
  })

  it('should render activity section after loading', async () => {
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText('My Recent Activity')).toBeInTheDocument()
    })
  })

  it('should show "No active leads" when no follow-ups', async () => {
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText("Today's Follow-ups")).toBeInTheDocument()
    })

    expect(screen.getByText('No active leads')).toBeInTheDocument()
  })

  it('should display zero counts when no data', async () => {
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Leads Assigned')).toBeInTheDocument()
    })

    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(3)
  })

  it('should display the current date in the welcome banner', async () => {
    render(<StaffDashboard />)

    await waitFor(() => {
      const today = new Date()
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      expect(screen.getByText(new RegExp(monthNames[today.getMonth()]))).toBeInTheDocument()
    })
  })
})

// ─── Scroll / Infinite Load Tests ─────────────────────────────────
describe('Staff Dashboard — Scroll & Infinite Load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(leadService.getAll).mockResolvedValue({ data: [] } as any)
    vi.mocked(taskService.getAll).mockResolvedValue({ data: [] } as any)
    vi.mocked(activityLogService.getAll).mockResolvedValue({ data: [] } as any)
  })

  const mockLeads = Array.from({ length: 15 }, (_, i) => ({
    id: `lead${i + 1}`,
    customerName: `Customer ${i + 1}`,
    phone: `90000000${String(i).padStart(2, '0')}`,
    status: 'Open' as const,
    dateAdded: '2024-01-15',
    assignedTo: 'staff1',
  }))

  const mockActivityLogs = Array.from({ length: 12 }, (_, i) => ({
    id: `log${i + 1}`,
    _id: `log${i + 1}`,
    action: `Action ${i + 1}`,
    actionType: 'Created',
    actorName: 'Staff',
    timestamp: new Date().toISOString(),
  }))

  it('should show follow-ups when Open/Qualified leads exist', async () => {
    mockServiceData(mockLeads, [], [])
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Customer 1')).toBeInTheDocument()
    })

    // Should show first 10 follow-ups by default
    expect(screen.getByText('Customer 1')).toBeInTheDocument()
    expect(screen.getByText('Customer 10')).toBeInTheDocument()
  })

  it('should show scroll hint when follow-ups exceed visible count', async () => {
    mockServiceData(mockLeads, [], [])
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Customer 1')).toBeInTheDocument()
    })

    // 15 leads, only 10 visible → should show scroll hint
    expect(screen.getByText('Scroll down for more...')).toBeInTheDocument()
  })

  it('should show all follow-ups shown when less than 10', async () => {
    mockServiceData(mockLeads.slice(0, 5), [], [])
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Customer 1')).toBeInTheDocument()
    })

    // 5 leads < 10 visible limit → all shown
    expect(screen.getByText('All follow-ups shown')).toBeInTheDocument()
    expect(screen.queryByText('Scroll down for more...')).not.toBeInTheDocument()
  })

  it('should render activity logs when available', async () => {
    mockServiceData([], [], mockActivityLogs)
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Action 1')).toBeInTheDocument()
    })

    // Timeline should render activity items
    expect(screen.getByText('Action 5')).toBeInTheDocument()
  })

  it('should show assigned leads count correctly with data', async () => {
    mockServiceData(mockLeads, [], [])
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Leads Assigned')).toBeInTheDocument()
    })

    // 15 leads assigned — find the count in the metric card
    const countElements = screen.getAllByText('15')
    expect(countElements.length).toBeGreaterThanOrEqual(1)
  })

  it('should compute active leads count correctly', async () => {
    const mixedLeads = [
      ...mockLeads.slice(0, 10).map(l => ({ ...l, status: 'Open' as const })),
      ...mockLeads.slice(10, 15).map(l => ({ ...l, status: 'Qualified' as const })),
    ]
    mockServiceData(mixedLeads, [], [])
    render(<StaffDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Active Leads')).toBeInTheDocument()
    })

    // Only Open leads count as active (10)
    const countElements = screen.getAllByText('10')
    expect(countElements.length).toBeGreaterThanOrEqual(1)
  })
})
