import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RideRequest } from './RideRequest';
import APIClient from '../lib/api';

// Mocks
vi.mock('../lib/api', () => ({
  default: {
    requestRide: vi.fn(),
  },
}));

describe('RideRequest Component', () => {
  const mockOnRideCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe cambiar entre tipo de servicio Viaje y Mandadito usando test IDs', () => {
    render(<RideRequest onRideCreated={mockOnRideCreated} />);
    
    // Cambiar a Mandadito
    const errandBtn = screen.getByTestId('errand-type-btn');
    fireEvent.click(errandBtn);
    expect(screen.getByRole('heading', { level: 3, name: /Solicitar Mandadito/i })).toBeInTheDocument();
    
    // Cambiar de nuevo a Viaje
    const rideBtn = screen.getByTestId('ride-type-btn');
    fireEvent.click(rideBtn);
    expect(screen.getByRole('heading', { level: 3, name: /Solicitar Viaje/i })).toBeInTheDocument();
  });

  it('debe realizar la solicitud exitosa usando test IDs', async () => {
    (APIClient.requestRide as any).mockResolvedValueOnce({ id: 'test-id' });
    render(<RideRequest onRideCreated={mockOnRideCreated} />);
    
    fireEvent.change(screen.getByPlaceholderText('Dirección de origen'), { target: { value: 'O' } });
    fireEvent.change(screen.getByPlaceholderText('Dirección de destino'), { target: { value: 'D' } });
    
    const submitBtn = screen.getByTestId('submit-request-btn');
    fireEvent.click(submitBtn);
    
    await waitFor(() => {
      expect(APIClient.requestRide).toHaveBeenCalled();
    });
  });
});
