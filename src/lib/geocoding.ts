export interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

const API_BASE = '/api/geocoding';

export async function geocodeAddress(address: string, lat?: number, lon?: number): Promise<GeocodingResult | null> {
  try {
    let url = `${API_BASE}/address?q=${encodeURIComponent(address)}`;
    if (lat && lon) {
      url += `&lat=${lat}&lon=${lon}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
        if (response.status === 429) {
            console.warn('Geocoding rate limit hit, using mock/last known logic or waiting');
        }
        return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function searchAddresses(query: string, lat?: number, lon?: number): Promise<GeocodingResult[]> {
  if (!query || query.length < 3) return [];
  try {
    let url = `${API_BASE}/search?q=${encodeURIComponent(query)}`;
    if (lat && lon) url += `&lat=${lat}&lon=${lon}`;

    const response = await fetch(url);
    if (!response.ok) return [];
    
    return await response.json();
  } catch (error) {
    console.error('Search geocoding error:', error);
    return [];
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodingResult | null> {
  try {
    const response = await fetch(`${API_BASE}/reverse?lat=${lat}&lon=${lon}`);
    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    return null;
  }
}

export function formatAddress(result: GeocodingResult): string {
  if (!result || !result.address) return result?.display_name || 'Ubicación desconocida';
  
  const { road, house_number, suburb, city, state, country } = result.address;
  const parts = [];

  if (road) {
    if (house_number) parts.push(`${road} ${house_number}`);
    else parts.push(road);
  } else if (house_number) {
    parts.push(house_number);
  }

  if (suburb) parts.push(suburb);
  else if (city) parts.push(city);
  
  if (state) parts.push(state);
  if (country) parts.push(country);

  return parts.join(', ') || result.display_name;
}
