export async function createPaymentPreference(driverId: string, amount: number, method: string, title: string) {
  console.log('Mock: Creating payment preference', { driverId, amount, method, title });
  return {
    preference_id: 'mock_pref_' + Date.now(),
    init_point: 'https://www.mercadopago.com.mx/checkout/mock'
  };
}

export async function saveCommissionPayment(driverId: string, amount: number, method: string, prefId: string, initPoint: string) {
  console.log('Mock: Saving commission payment', { driverId, amount, method, prefId, initPoint });
  return { success: true };
}
