import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockLeadService, mockUserService, mockUseAuth } = vi.hoisted(() => ({
  mockLeadService: {
    getFollowUps: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
  },
  mockUserService: { getAll: vi.fn() },
  mockUseAuth: vi.fn(),
}));

vi.mock('@/services', () => ({
  leadService: mockLeadService,
  userService: mockUserService,
}));

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (v: any) => v,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import AdminFollowUps from '@/pages/admin/FollowUps';
import StaffFollowUps from '@/pages/staff/FollowUps';

describe('FollowUps Screens - Pending Count & Pending Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ role: 'admin', userId: 'admin-1' });
    mockUserService.getAll.mockResolvedValue({ data: [] });
    mockLeadService.getFollowUps.mockResolvedValue({
      data: [
        {
          leadId: 'l1',
          followUpId: 'fu1',
          leadName: 'John Doe',
          phone: '9876543210',
          nextFollowUpDate: '2026-07-20',
          outcome: 'Interested',
        },
      ],
      total: 1,
      pages: 1,
      stats: {
        totalCount: 1,
        positiveCount: 1,
        negativeCount: 0,
        pendingCount: 1,
      },
    });
  });

  it('renders Pending Follow-ups card and pending option in date filter for Admin', async () => {
    render(
      <MemoryRouter>
        <AdminFollowUps />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending Follow-ups')).toBeInTheDocument();
    });

    expect(screen.getByText('Pending Follow-ups')).toBeInTheDocument();
    expect(screen.getByText('Pending (Overdue)')).toBeInTheDocument();
  });

  it('renders Pending Follow-ups card and pending option in date filter for Staff', async () => {
    mockUseAuth.mockReturnValue({ role: 'staff', userId: 'staff-1' });

    render(
      <MemoryRouter>
        <StaffFollowUps />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending Follow-ups')).toBeInTheDocument();
    });

    expect(screen.getByText('Pending Follow-ups')).toBeInTheDocument();
    expect(screen.getByText('Pending (Overdue)')).toBeInTheDocument();
  });
});
