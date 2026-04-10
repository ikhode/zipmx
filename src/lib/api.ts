export interface APIUser {
  id: string;
  email: string;
  fullName: string;
  userType: 'passenger' | 'driver';
  phone: string;
  verified: boolean;
  profileImageUrl?: string | null;
}

export interface APIRide {
  id: string;
  status: 'requested' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress: string;
  totalFare: number;
  baseFare: number;
  rideType: 'ride' | 'errand';
  distanceKm: number;
  estimatedDurationMinutes: number;
  errandDescription?: string;
  errandItems?: string;
  passengerId: string;
  driverId?: string | null;
  createdAt: string;
}

class APIClient {
  private static token: string | null = localStorage.getItem('zipp_auth_token');

  private static async fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 500): Promise<Response> {
    try {
      const res = await fetch(url, options);
      if (!res.ok && res.status >= 500 && retries > 0) {
         throw new Error(`Server error: ${res.status}`);
      }
      return res;
    } catch (err) {
      if (retries <= 0) throw err;
      await new Promise(resolve => setTimeout(resolve, backoff));
      return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
  }

  private static async request(path: string, options: RequestInit = {}) {
    const url = `/api${path}`;
    const requestOptions = {
      ...options,
      headers: {
        ...options.headers,
        ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
        'Content-Type': 'application/json',
      },
    };

    try {
      const response = await this.fetchWithRetry(url, requestOptions);
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      const bodyText = await response.text();
      let bodyData: any = bodyText;
      
      if (isJson) {
        try {
          bodyData = JSON.parse(bodyText);
        } catch (e) {
          console.warn('Failed to parse JSON despite content-type:', e);
        }
      }

      if (!response.ok) {
        const errorMessage = (isJson && bodyData.error) ? bodyData.error : (bodyText || 'Error en la solicitud al servidor');
        throw new Error(errorMessage);
      }

      return bodyData;
    } catch (err: any) {
      console.error(`API Error [${path}]:`, err);
      if (err.message.includes('Failed to fetch')) {
        throw new Error('No se pudo contactar con el servidor. Revisa tu conexión.');
      }
      throw err;
    }
  }

  static async signup(data: any) {
    const res = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.token = res.token;
    localStorage.setItem('zipp_auth_token', res.token);
    return res.user;
  }

  static async quickSignup(fullName: string, phone: string, userType: 'passenger' | 'driver' = 'passenger') {
    const email = `${phone}@zipp.app`;
    try {
      return await this.signup({
        fullName,
        phone,
        email,
        password: phone,
        userType,
      });
    } catch (error: any) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('ya está registrado') || msg.includes('registrado') || msg.includes('unique')) {
        // Fallback: If they already exist, just log them in seamlessly.
        return await this.login(email, phone);
      }
      throw error;
    }
  }

  static async login(email: string, password?: string) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.token = res.token;
    localStorage.setItem('zipp_auth_token', res.token);
    return res.user;
  }

  static async getProfile() {
    if (!this.token) return null;
    try {
      return await this.request('/profile');
    } catch {
      this.logout();
      return null;
    }
  }

  static async updateProfile(data: Partial<APIUser>) {
    return await this.request('/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Passenger methods
  static async getMyRides() {
    return await this.request('/rides/my');
  }

  static async getMyActiveRide() {
    return await this.request('/rides/my-active');
  }

  static async requestRide(data: {
    pickup: { lat: number, lng: number, address: string },
    dropoff: { lat: number, lng: number, address: string },
    type: 'ride' | 'errand',
    price: number,
    distance: number,
    duration: number,
    description?: string,
    items?: string
  }) {
    return await this.request('/rides/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async cancelRide(rideId: string) {
    return await this.request(`/rides/${rideId}/cancel`, {
      method: 'POST',
    });
  }

  // Driver methods
  static async getDriverSetup() {
    return await this.request('/driver/setup');
  }

  static async setupDriver(vehicleType: string) {
    return await this.request('/driver/setup', {
      method: 'POST',
      body: JSON.stringify({ vehicleType }),
    });
  }

  static async getDriverSettings() {
    return await this.request('/driver/settings');
  }

  static async updateDriverSettings(data: { baseFare: number, costPerKm: number, costPerMinute: number }) {
    return await this.request('/driver/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async updateDriverLocation(lat: number, lng: number) {
    return await this.request('/driver/location', {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
    });
  }

  static async verifyIdentity(data: { profilePhoto: string, idPhoto: string | null, type: string }) {
    return await this.request('/verify-identity', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async getNearbyDrivers(lat: number, lng: number) {
    return await this.request(`/drivers/nearby?lat=${lat}&lng=${lng}`);
  }

  static async getAvailableRides() {
    return await this.request('/rides/available');
  }

  static async getActiveRide() {
    return await this.request('/rides/active');
  }

  static async acceptRide(rideId: string) {
    return await this.request(`/rides/${rideId}/accept`, {
      method: 'POST',
    });
  }

  static async updateRideStatus(rideId: string, status: string) {
    return await this.request(`/rides/${rideId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  static async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const url = `/api/upload`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al subir archivo');
    }

    return await response.json();
  }

  static async sendOTP(_phone: string) {
    // This is now handled directly by Firebase SDK in the frontend
    console.warn('APIClient.sendOTP is deprecated. Use Firebase SDK instead.');
    return { success: true };
  }

  static async verifyOTP(phone: string, idToken: string) {
    const res = await this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, idToken })
    });
    if (res.token) {
        this.token = res.token;
        localStorage.setItem('zipp_auth_token', res.token);
    }
    return res;
  }

  static async deleteAccount() {
    const res = await this.request('/profile', {
      method: 'DELETE',
    });
    this.logout();
    return res;
  }

  static logout() {
    this.token = null;
    localStorage.removeItem('zipp_auth_token');
  }

  static get isAuthenticated() {
    return !!this.token;
  }
}

export default APIClient;
