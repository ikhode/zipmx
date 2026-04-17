import { type User, type Ride } from '../db/schema';

export type APIUser = User;
export type APIRide = Ride;

interface AuthResponse {
  user: APIUser;
  token: string;
}

interface OTPResponse extends AuthResponse {
  success: boolean;
  isNewUser: boolean;
}

export interface DriverPublicInfo {
  fullName: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleType: string;
  licensePlate: string;
  rating: number;
  totalTrips: number;
}

/** Ride returned by /rides/available — includes passenger rating fields */
export type EnrichedRide = APIRide & {
  passengerRating: number | null;
  passengerTotalRatings: number;
};

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

  private static async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
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

      return bodyData as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`API Error [${path}]:`, message);
      if (message.includes('Failed to fetch')) {
        throw new Error('No se pudo contactar con el servidor. Revisa tu conexión.');
      }
      throw err;
    }
  }

  static async signup(data: Partial<APIUser> & { password?: string }) {
    const res = await this.request<AuthResponse>('/auth/signup', {
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('ya está registrado') || message.includes('registrado') || message.includes('unique')) {
        // Fallback: If they already exist, just log them in seamlessly.
        return await this.login(email, phone);
      }
      throw error;
    }
  }

  static async login(email: string, password?: string) {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.token = res.token;
    localStorage.setItem('zipp_auth_token', res.token);
    return res.user;
  }

  static async getProfile(): Promise<APIUser | null> {
    if (!this.token) return null;
    try {
      return await this.request<APIUser>('/profile');
    } catch {
      this.logout();
      return null;
    }
  }

  static async updateProfile(data: Partial<APIUser>) {
    return await this.request<APIUser>('/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Passenger methods
  static async getMyRides(): Promise<APIRide[]> {
    return await this.request<APIRide[]>('/rides/my');
  }

  static async getMyActiveRide(): Promise<APIRide | null> {
    return await this.request<APIRide | null>('/rides/my-active');
  }

  static async getRideDetails(rideId: string): Promise<APIRide & { driverInfo?: DriverPublicInfo | null }> {
    return await this.request(`/rides/${rideId}/details`);
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

  static async setupDriver(data: {
    vehicleType: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleYear: number;
    licensePlate: string;
  }) {
    return await this.request('/driver/setup', {
      method: 'POST',
      body: JSON.stringify(data),
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

  static async updateDriverStatus(isActive: boolean) {
    return await this.request('/driver/status', {
      method: 'POST',
      body: JSON.stringify({ isActive }),
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

  static async getAvailableRides(): Promise<EnrichedRide[]> {
    return await this.request<EnrichedRide[]>('/rides/available');
  }

  static async getActiveRide() {
    return await this.request('/rides/active');
  }

  static async acceptRide(rideId: string) {
    return await this.request(`/rides/${rideId}/accept`, {
      method: 'POST',
    });
  }

  static async submitRating(rideId: string, data: { ratedId: string, rating: number, comment?: string }) {
    return await this.request(`/rides/${rideId}/rate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getUserRatings(userId: string) {
    return await this.request(`/ratings/user/${userId}`);
  }

  static async getRatingSummary(userId: string) {
    return await this.request(`/ratings/summary/${userId}`);
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
    const res = await this.request<OTPResponse>('/auth/verify-otp', {
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
