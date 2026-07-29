import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { mockLeadService, mockProjectService, mockPlotService, mockUserService, mockChannelPartnerService } = vi.hoisted(() => ({
  mockLeadService: {
    getById: vi.fn(),
    update: vi.fn(),
  },
  mockProjectService: { getAll: vi.fn() },
  mockPlotService: { getAll: vi.fn() },
  mockUserService: { getAll: vi.fn() },
  mockChannelPartnerService: { getAll: vi.fn() },
}));

vi.mock('@/services', () => ({
  leadService: mockLeadService,
  projectService: mockProjectService,
  plotService: mockPlotService,
  userService: mockUserService,
  channelPartnerService: mockChannelPartnerService,
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

import AdminLeadDetail from '../admin/LeadDetail';

describe('AdminLeadDetail - Follow-up Log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectService.getAll.mockResolvedValue({ data: [] });
    mockPlotService.getAll.mockResolvedValue({ data: [] });
    mockUserService.getAll.mockResolvedValue({ data: [] });
    mockChannelPartnerService.getAll.mockResolvedValue({ data: [] });

    mockLeadService.getById.mockResolvedValue({
      data: {
        _id: '507f1f77bcf86cd799439011',
        displayId: 'L-1001',
        customerName: 'Rajesh Sharma',
        phone: '9876543210',
        gender: 'Male',
        status: 'Open',
        sourceType: 'Direct',
        followUps: [],
      },
    });

    mockLeadService.update.mockResolvedValue({
      data: {
        _id: '507f1f77bcf86cd799439011',
        displayId: 'L-1001',
        customerName: 'Rajesh Sharma',
        phone: '9876543210',
        gender: 'Male',
        status: 'Open',
        sourceType: 'Direct',
        followUps: [
          {
            id: 'fu-123',
            date: '2026-07-28',
            outcome: 'Interested',
            notes: 'Spoke with customer about villa project',
            nextAction: 'Follow up again',
          },
        ],
      },
    });
  });

  it('opens Log Follow-up modal and saves follow-up log successfully', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/leads/507f1f77bcf86cd799439011']}>
        <Routes>
          <Route path="/admin/leads/:id" element={<AdminLeadDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Rajesh Sharma')).toBeInTheDocument();
    });

    const logBtn = screen.getByRole('button', { name: /Log Follow-up/i });
    fireEvent.click(logBtn);

    expect(screen.getByText('Log Follow-up')).toBeInTheDocument();

    const notesTextarea = screen.getByPlaceholderText('Details of the conversation with customer...');
    fireEvent.change(notesTextarea, { target: { value: 'Spoke with customer about villa project' } });

    const saveBtns = screen.getAllByRole('button', { name: /Log Follow-up/i });
    fireEvent.click(saveBtns[saveBtns.length - 1]);

    await waitFor(() => {
      expect(mockLeadService.update).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({
          followUps: expect.arrayContaining([
            expect.objectContaining({
              outcome: 'Interested',
              notes: 'Spoke with customer about villa project',
            }),
          ]),
        })
      );
    });
  });
});
