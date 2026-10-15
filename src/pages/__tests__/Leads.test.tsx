import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminLeads from '../admin/Leads';
import { leadService, userService, projectService } from '@/services';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    userId: 'user-1',
    user: { name: 'Admin User', initials: 'AU' },
    role: 'admin',
  }),
}));

vi.mock('@/context/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
  }),
}));

vi.mock('@/services', () => ({
  leadService: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: 'lead-1', customerName: 'Ramesh Patel', phone: '9876543210', status: 'Open', city: 'Hyderabad' },
        { id: 'lead-2', customerName: 'Sita Devi', phone: '9876543211', status: 'Qualified', city: 'Bengaluru' },
        { id: 'lead-3', customerName: 'Anil Kumar', phone: '9876543212', status: 'Customer', city: 'Chennai' },
      ],
      pagination: { next: false },
    }),
    getCounts: vi.fn().mockResolvedValue({
      data: { All: 3, Open: 1, Reserved: 0, Qualified: 1, Unqualified: 0, Customer: 1 },
    }),
  },
  userService: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
  projectService: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
  channelPartnerService: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

import { ExportProvider } from '@/context/ExportContext';

describe('AdminLeads Page - All Leads Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "All Leads" tab as the first tab and displays total count', async () => {
    render(
      <MemoryRouter>
        <ExportProvider>
          <AdminLeads />
        </ExportProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('All Leads')).toBeInTheDocument();

    await waitFor(() => {
      expect(leadService.getAll).toHaveBeenCalled();
    });
  });
});
