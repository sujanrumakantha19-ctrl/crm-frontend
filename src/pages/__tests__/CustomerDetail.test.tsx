import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { mockLeadService, mockProjectService, mockPlotService } = vi.hoisted(() => ({
  mockLeadService: {
    getById: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  },
  mockProjectService: { getAll: vi.fn() },
  mockPlotService: {
    getById: vi.fn(),
    getAll: vi.fn(),
    getCustomerBookings: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

vi.mock('@/services', () => ({
  leadService: mockLeadService,
  projectService: mockProjectService,
  plotService: mockPlotService,
  taskService: { create: vi.fn() },
  userService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    userId: 'admin-1',
    user: { name: 'Admin User', initials: 'AU' },
    role: 'admin',
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import AdminCustomerDetail from '../admin/CustomerDetail';

describe('AdminCustomerDetail - Registered Record Detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectService.getAll.mockResolvedValue({
      data: [{ _id: 'proj-1', name: 'Green Valley', displayId: 'PROJ-1' }],
    });
    const mockPlot = {
      _id: 'plot-1',
      id: 'plot-1',
      plotNumber: '101',
      status: 'Registered',
      projectId: { _id: 'proj-1', name: 'Green Valley', displayId: 'PROJ-1' },
      size: 200,
      sizeUnit: 'Sq Yards',
      facing: 'East',
      type: 'Residential',
      registrationDate: '2026-07-20',
      bookedBy: {
        name: 'Kavitha Reddy',
        phone: '9876543210',
        paymentStatus: 'Fully Paid',
        paymentMethod: 'CASH',
      },
    };
    mockPlotService.getAll.mockResolvedValue({ data: [mockPlot] });
    mockPlotService.getById.mockResolvedValue({ data: mockPlot });
    mockPlotService.getCustomerBookings.mockResolvedValue({ data: [mockPlot] });
  });

  it('renders Customer Detail screen cleanly when navigating from Registered tab with Plot ID', async () => {
    mockLeadService.getById.mockRejectedValue(new Error('Not a lead ID'));
    mockLeadService.getAll.mockResolvedValue({ data: [] });

    render(
      <MemoryRouter initialEntries={['/admin/registrations/plot-1?tab=registered']}>
        <Routes>
          <Route path="/admin/registrations/:id" element={<AdminCustomerDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Registered Customer Details')).toBeInTheDocument();
    });

    expect(screen.getByText('Kavitha Reddy')).toBeInTheDocument();
    expect(screen.getByText('Registered Customer Details')).toBeInTheDocument();
  });
});
