import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MapView } from './MapView';

// Mock Leaflet
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn().mockReturnValue({
      setView: vi.fn().mockReturnThis(),
      on: vi.fn(),
      remove: vi.fn(),
      invalidateSize: vi.fn(),
      removeLayer: vi.fn(),
    }),
    tileLayer: vi.fn().mockReturnValue({
      addTo: vi.fn(),
    }),
    control: {
      zoom: vi.fn().mockReturnValue({
        addTo: vi.fn(),
      }),
    },
    marker: vi.fn().mockReturnValue({
      addTo: vi.fn(),
      remove: vi.fn(),
      setLatLng: vi.fn(),
    }),
    icon: vi.fn(),
    divIcon: vi.fn(),
    polyline: vi.fn().mockReturnValue({
      addTo: vi.fn(),
    }),
    latLngBounds: vi.fn().mockReturnValue({
      extend: vi.fn(),
    }),
  },
}));

describe('MapView Component', () => {
  it('debe renderizar el contenedor del mapa', () => {
    const { container } = render(<MapView />);
    const mapContainer = container.querySelector('.map-container');
    expect(mapContainer).toBeInTheDocument();
  });

  it('debe mostrar el pin central cuando selectingLocation es true', () => {
    const { container } = render(<MapView selectingLocation={true} />);
    const pin = container.querySelector('.center-pin-wrapper');
    expect(pin).toBeInTheDocument();
  });

  it('no debe mostrar el pin central cuando selectingLocation es false', () => {
    const { container } = render(<MapView selectingLocation={false} />);
    const pin = container.querySelector('.center-pin-wrapper');
    expect(pin).not.toBeInTheDocument();
  });
});
