import { useState, useEffect } from 'react';
import APIClient from '../lib/api';
import { createPaymentPreference, saveCommissionPayment } from '../lib/mercadopago';
import { useToast } from './ToastProvider';

interface DriverCommissionTrackerProps {
  driverId: string;
}

export function DriverCommissionTracker({ driverId }: DriverCommissionTrackerProps) {
  const { showToast } = useToast();
  const [driver, setDriver] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'oxxo' | 'debit_card' | 'credit_card' | 'spei'>('oxxo');
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    loadDriverData();
    loadPayments();
  }, [driverId]);

  async function loadDriverData() {
    const data = await APIClient.getDriverSetup();
    if (data) {
      setDriver(data);
    }
    setLoading(false);
  }

  async function loadPayments() {
    // Temporarily disabled for migration
    setPayments([]);
  }

  async function handlePayment() {
    if (!driver) return;

    try {
      setProcessingPayment(true);

      const preference = await createPaymentPreference(
        driverId,
        driver.unpaidCommissionAmount,
        paymentMethod,
        `Pago de comisiones Zipp - ${driver.unpaidCommissionAmount.toFixed(2)} MXN`
      );

      await saveCommissionPayment(
        driverId,
        driver.unpaidCommissionAmount,
        paymentMethod,
        preference.preference_id,
        preference.init_point
      );

      window.open(preference.init_point, '_blank');

      await loadDriverData();
      await loadPayments();
    } catch (error) {
      console.error('Error processing payment:', error);
      showToast('Error al procesar el pago. Por favor intenta de nuevo.', 'error');
    } finally {
      setProcessingPayment(false);
    }
  }


  if (loading) {
    return <div className="loading">Cargando información...</div>;
  }

  if (!driver) {
    return <div className="error">No se encontró información del conductor</div>;
  }

  const isBlocked = driver.isBlocked;
  const unpaidAmount = driver.unpaidCommissionAmount;
  const freeTripsRemaining = Math.max(0, 5 - driver.totalTrips);
  const commissionRate = driver.totalTrips < 5 ? 0 : 10;

  return (
    <div className="commission-tracker">
      <div className="commission-header">
        <h2>Estado de Comisiones</h2>
        {isBlocked && (
          <div className="alert alert-danger">
            Tu cuenta está bloqueada. Debes pagar tus comisiones para continuar.
          </div>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total de Viajes</div>
          <div className="stat-value">{driver.totalTrips}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Tasa de Comisión Actual</div>
          <div className="stat-value">{commissionRate}%</div>
        </div>

        {freeTripsRemaining > 0 && (
          <div className="stat-card highlight">
            <div className="stat-label">Viajes Gratis Restantes</div>
            <div className="stat-value">{freeTripsRemaining}</div>
          </div>
        )}

        <div className={`stat-card ${unpaidAmount >= 150 ? 'danger' : ''}`}>
          <div className="stat-label">Comisiones Sin Pagar</div>
          <div className="stat-value">${unpaidAmount.toFixed(2)} MXN</div>
        </div>
      </div>

      {unpaidAmount > 0 && (
        <div className="payment-section">
          <h3>Pagar Comisiones</h3>
          <p className="payment-description">
            {isBlocked
              ? 'Debes pagar tus comisiones para desbloquear tu cuenta y seguir aceptando viajes.'
              : 'Mantén tus comisiones al día para evitar el bloqueo de tu cuenta.'}
          </p>

          <div className="payment-amount">
            <span className="amount-label">Monto a pagar:</span>
            <span className="amount-value">${unpaidAmount.toFixed(2)} MXN</span>
          </div>

          <div className="payment-methods">
            <label className="payment-method-label">Método de Pago:</label>
            <div className="payment-method-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="payment_method"
                  value="oxxo"
                  checked={paymentMethod === 'oxxo'}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                />
                <span>OXXO</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="payment_method"
                  value="debit_card"
                  checked={paymentMethod === 'debit_card'}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                />
                <span>Tarjeta de Débito</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="payment_method"
                  value="credit_card"
                  checked={paymentMethod === 'credit_card'}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                />
                <span>Tarjeta de Crédito</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="payment_method"
                  value="spei"
                  checked={paymentMethod === 'spei'}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                />
                <span>Transferencia SPEI</span>
              </label>
            </div>
          </div>

          <button
            className="btn-primary btn-large"
            onClick={handlePayment}
            disabled={processingPayment}
          >
            {processingPayment ? 'Procesando...' : 'Pagar Ahora'}
          </button>
        </div>
      )}

      <div className="payments-history">
        <h3>Historial de Pagos</h3>
        {payments.length === 0 ? (
          <p className="empty-state">No hay pagos registrados</p>
        ) : (
          <div className="payments-list">
            {payments.map((payment) => (
              <div key={payment.id} className="payment-item">
                <div className="payment-info">
                  <div className="payment-amount">${payment.amount.toFixed(2)} MXN</div>
                  <div className="payment-method">{getPaymentMethodLabel(payment.payment_method)}</div>
                  <div className="payment-date">
                    {new Date(payment.created_at).toLocaleDateString('es-MX')}
                  </div>
                </div>
                <div className={`payment-status status-${payment.status}`}>
                  {getStatusLabel(payment.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    oxxo: 'OXXO',
    debit_card: 'Tarjeta de Débito',
    credit_card: 'Tarjeta de Crédito',
    spei: 'Transferencia SPEI',
  };
  return labels[method] || method;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
}
