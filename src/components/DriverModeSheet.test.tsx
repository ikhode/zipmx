import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriverModeSheet } from './DriverModeSheet';
import APIClient from '../lib/api';

// Mocks
vi.mock('../lib/api', () => ({
  default: {
    getAvailableRides: vi.fn(),
    getActiveRide: vi.fn(),
    getDriverSetup: vi.fn(),
    setupDriver: vi.fn(),
    updateRideStatus: vi.fn(),
    acceptRide: vi.fn(),
  },
}));

describe('DriverModeSheet Component', () => {
  const mockSession = { 
    user: { 
      id: 'driver-1',
      email: 'driver@test.com',
      phone: '1234567890',
      fullName: 'Test Driver',
      userType: 'driver' as const,
      profileImageUrl: null,
      passwordHash: null,
      verified: true,
      createdAt: null,
      updatedAt: null
    } 
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe permitir seleccionar un tipo de vehículo y configurar al conductor', async () => {
    (APIClient.getDriverSetup as any).mockResolvedValueOnce(null);
    (APIClient.setupDriver as any).mockResolvedValueOnce({ success: true });

    render(<DriverModeSheet session={mockSession} onLoginRequired={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('driver-setup-btn')).toBeInTheDocument();
    });

    const motoBtn = screen.getByTestId('vehicle-btn-motorcycle');
    fireEvent.click(motoBtn);

    const startBtn = screen.getByTestId('driver-setup-btn');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(APIClient.setupDriver).toHaveBeenCalledWith('motorcycle');
    });
  });

  it('debe mostrar el estado de conexión actual', async () => {
    (APIClient.getDriverSetup as any).mockResolvedValueOnce({ isActive: true });
    (APIClient.getAvailableRides as any).mockResolvedValueOnce([]);
    (APIClient.getActiveRide as any).mockResolvedValueOnce(null);

    render(<DriverModeSheet session={mockSession} onLoginRequired={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/ESTÁS EN LÍNEA/i)).toBeInTheDocument();
    });
  });
});
