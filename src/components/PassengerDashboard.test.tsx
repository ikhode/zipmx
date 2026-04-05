import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PassengerDashboard } from './PassengerDashboard';
import APIClient from '../lib/api';

// Mocks
vi.mock('../lib/api', () => ({
  default: {
    getMyRides: vi.fn(),
    getMyActiveRide: vi.fn(),
    cancelRide: vi.fn(),
  },
}));

// Mock RideRequest component since it's tested separately
vi.mock('./RideRequest', () => ({
  RideRequest: () => <div data-testid="ride-request">RideRequest Component</div>,
}));

describe('PassengerDashboard Component', () => {
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe mostrar el estado de carga inicialmente', () => {
    (APIClient.getMyRides as any).mockReturnValue(new Promise(() => {}));
    (APIClient.getMyActiveRide as any).mockReturnValue(new Promise(() => {}));

    render(<PassengerDashboard userId={userId} />);
    expect(screen.getByText(/Cargando tus viajes/i)).toBeInTheDocument();
  });

  it('debe renderizar RideRequest si no hay viaje activo', async () => {
    (APIClient.getMyRides as any).mockResolvedValueOnce([]);
    (APIClient.getMyActiveRide as any).mockResolvedValueOnce(null);

    render(<PassengerDashboard userId={userId} />);

    await waitFor(() => {
      expect(screen.getByTestId('ride-request')).toBeInTheDocument();
    });
  });

  it('debe mostrar el viaje activo si existe', async () => {
    const mockActiveRide = {
      id: 'ride-active',
      rideType: 'ride',
      status: 'accepted',
      pickupAddress: 'Origen A',
      dropoffAddress: 'Destino B',
      totalFare: 150.50,
      createdAt: new Date().toISOString()
    };

    (APIClient.getMyRides as any).mockResolvedValueOnce([]);
    (APIClient.getMyActiveRide as any).mockResolvedValueOnce(mockActiveRide);

    render(<PassengerDashboard userId={userId} />);

    await waitFor(() => {
      expect(screen.getByText(/Servicio Activo/i)).toBeInTheDocument();
      expect(screen.getByText('Origen A')).toBeInTheDocument();
      expect(screen.getByText('Destino B')).toBeInTheDocument();
      expect(screen.getByText('$150.50 MXN')).toBeInTheDocument();
    });
  });

  it('debe mostrar el historial de viajes', async () => {
    const mockHistory = [
      {
        id: 'ride-1',
        rideType: 'ride',
        status: 'completed',
        pickupAddress: 'H1 Origen',
        dropoffAddress: 'H1 Destino',
        totalFare: 80,
        createdAt: '2024-01-01T10:00:00Z'
      }
    ];

    (APIClient.getMyRides as any).mockResolvedValueOnce(mockHistory);
    (APIClient.getMyActiveRide as any).mockResolvedValueOnce(null);

    render(<PassengerDashboard userId={userId} />);

    await waitFor(() => {
      expect(screen.getByText('H1 Origen')).toBeInTheDocument();
      expect(screen.getByText('H1 Destino')).toBeInTheDocument();
      expect(screen.getByText('$80.00 MXN')).toBeInTheDocument();
    });
  });
});
