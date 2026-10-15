import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareLocationModal } from '../ShareLocationModal';
import { leadService, whatsappService } from '@/services';

vi.mock('@/services', () => ({
  leadService: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: 'lead-1', customerName: 'Ramesh Patel', phone: '+91 98765 12345', city: 'Hyderabad', status: 'Open' },
        { id: 'lead-2', customerName: 'Sita Devi', phone: '+91 98765 67890', city: 'Bengaluru', status: 'Qualified' },
      ],
    }),
  },
  whatsappService: {
    send: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('ShareLocationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open with project info and template greeting from Samy & Co', async () => {
    const mockProject = {
      id: 'proj-1',
      name: 'Green Valley Enclave',
      location: 'Hyderabad',
      latitude: '17.4483',
      longitude: '78.3741',
    };

    render(<ShareLocationModal open={true} onClose={vi.fn()} project={mockProject} />);

    expect(screen.getByText('Share Project Location')).toBeInTheDocument();
    expect(screen.getAllByText(/Green Valley Enclave/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Greetings from/)).toBeInTheDocument();
    expect(screen.getAllByText(/Samy & Co/).length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(screen.getByText('Ramesh Patel')).toBeInTheDocument();
      expect(screen.getByText('Sita Devi')).toBeInTheDocument();
    });
  });

  it('immediately triggers direct wa.me window.open for single recipient without calling whatsappService.send', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const mockProject = {
      id: 'proj-1',
      name: 'Green Valley Enclave',
      location: 'Hyderabad',
    };

    render(<ShareLocationModal open={true} onClose={vi.fn()} project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('Ramesh Patel')).toBeInTheDocument();
    });

    // Select single lead Ramesh Patel
    fireEvent.click(screen.getByText('Ramesh Patel'));

    const sendBtn = screen.getByText(/Send WhatsApp/);
    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/919876512345?text='),
        '_blank'
      );
      expect(whatsappService.send).not.toHaveBeenCalled();
    });

    windowOpenSpy.mockRestore();
  });

  it('calls whatsappService.send for multiple selected recipients', async () => {
    const mockProject = {
      id: 'proj-1',
      name: 'Green Valley Enclave',
      location: 'Hyderabad',
    };

    render(<ShareLocationModal open={true} onClose={vi.fn()} project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('Ramesh Patel')).toBeInTheDocument();
      expect(screen.getByText('Sita Devi')).toBeInTheDocument();
    });

    // Select both leads
    fireEvent.click(screen.getByText('Ramesh Patel'));
    fireEvent.click(screen.getByText('Sita Devi'));

    const sendBtn = screen.getByText(/Send WhatsApp/);
    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(whatsappService.send).toHaveBeenCalledTimes(2);
      expect(whatsappService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+919876512345',
          message: expect.stringContaining('Greetings from Samy & Co!'),
        })
      );
      expect(whatsappService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+919876567890',
          message: expect.stringContaining('Greetings from Samy & Co!'),
        })
      );
    });
  });
});
