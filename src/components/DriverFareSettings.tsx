import { useState, useEffect } from 'react';
import APIClient from '../lib/api';

export function DriverFareSettings() {
  const [settings, setSettings] = useState({
    baseFare: 25,
    costPerKm: 10,
    costPerMinute: 2
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulator state
  const [simDistance, setSimDistance] = useState(5);
  const [simDuration, setSimDuration] = useState(15);

  const limits = {
    baseFare: { min: 20, max: 40 },
    costPerKm: { min: 6, max: 12 },
    costPerMinute: { min: 1.5, max: 3 }
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await APIClient.getDriverSettings();
        if (data) {
          setSettings({
            baseFare: data.baseFare || 25,
            costPerKm: data.costPerKm || 10,
            costPerMinute: data.costPerMinute || 2
          });
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (field: string, value: string) => {
    const numValue = parseFloat(value);
    setSettings(prev => ({ ...prev, [field]: numValue }));
    setSuccess(false);
    setError(null);
  };

  const handleSave = async () => {
    if (settings.baseFare < limits.baseFare.min || settings.baseFare > limits.baseFare.max) {
      setError(`Tarifa base debe estar entre $${limits.baseFare.min} y $${limits.baseFare.max}`);
      return;
    }
    if (settings.costPerKm < limits.costPerKm.min || settings.costPerKm > limits.costPerKm.max) {
      setError(`Costo por km debe estar entre $${limits.costPerKm.min} y $${limits.costPerKm.max}`);
      return;
    }
    if (settings.costPerMinute < limits.costPerMinute.min || settings.costPerMinute > limits.costPerMinute.max) {
      setError(`Costo por minuto debe estar entre $${limits.costPerMinute.min} y $${limits.costPerMinute.max}`);
      return;
    }

    setSaving(true);
    try {
      await APIClient.updateDriverSettings(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const simTotal = settings.baseFare + (simDistance * settings.costPerKm) + (simDuration * settings.costPerMinute);

  if (loading) return <div className="loading-shimmer" style={{ height: '300px', borderRadius: '16px' }}></div>;

  return (
    <div className="fare-settings-container card-glass">
      <h3 className="section-title">Configuración de Tarifas</h3>
      <p className="section-subtitle">Define cuánto quieres ganar por viaje dentro de los rangos permitidos.</p>

      <div className="settings-grid">
        <div className="input-group-premium">
          <label>Tarifa Base (MXN)</label>
          <div className="input-wrapper">
            <span className="currency">$</span>
            <input 
              type="number" 
              value={settings.baseFare} 
              onChange={(e) => handleChange('baseFare', e.target.value)}
              min={limits.baseFare.min}
              max={limits.baseFare.max}
              step="1"
            />
          </div>
          <small>Rango: ${limits.baseFare.min} - ${limits.baseFare.max}</small>
        </div>

        <div className="input-group-premium">
          <label>Costo por KM (MXN)</label>
          <div className="input-wrapper">
            <span className="currency">$</span>
            <input 
              type="number" 
              value={settings.costPerKm} 
              onChange={(e) => handleChange('costPerKm', e.target.value)}
              min={limits.costPerKm.min}
              max={limits.costPerKm.max}
              step="0.5"
            />
          </div>
          <small>Rango: ${limits.costPerKm.min} - ${limits.costPerKm.max}</small>
        </div>

        <div className="input-group-premium">
          <label>Tiempo de espera (minuto)</label>
          <div className="input-wrapper">
            <span className="currency">$</span>
            <input 
              type="number" 
              value={settings.costPerMinute} 
              onChange={(e) => handleChange('costPerMinute', e.target.value)}
              min={limits.costPerMinute.min}
              max={limits.costPerMinute.max}
              step="0.1"
            />
          </div>
          <small>Rango: ${limits.costPerMinute.min} - ${limits.costPerMinute.max}</small>
        </div>
      </div>

      {error && <div className="error-badge animate-fade-in">{error}</div>}
      
      <button 
        className={`btn-primary w-full mt-4 ${saving ? 'loading' : ''} ${success ? 'success' : ''}`} 
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Guardando...' : success ? '¡Tarifas actualizadas!' : 'Guardar Cambios'}
      </button>

      <div className="simulator-section card-inner-glass mt-6">
        <h4>Simulador de Ganancias</h4>
        <p className="text-xs opacity-70">Previsualiza cómo se calcularía un viaje promedio.</p>
        
        <div className="sim-controls mt-3">
          <div className="sim-control">
            <label>Distancia: {simDistance} km</label>
            <input 
              type="range" 
              min="1" 
              max="50" 
              value={simDistance} 
              onChange={(e) => setSimDistance(parseInt(e.target.value))} 
            />
          </div>
          <div className="sim-control">
            <label>Duración: {simDuration} min</label>
            <input 
              type="range" 
              min="1" 
              max="120" 
              value={simDuration} 
              onChange={(e) => setSimDuration(parseInt(e.target.value))} 
            />
          </div>
        </div>

        <div className="sim-result mt-4">
          <div className="sim-row">
            <span>Base</span>
            <span>${settings.baseFare.toFixed(2)}</span>
          </div>
          <div className="sim-row">
            <span>Distancia</span>
            <span>${(simDistance * settings.costPerKm).toFixed(2)}</span>
          </div>
          <div className="sim-row">
            <span>Tiempo</span>
            <span>${(simDuration * settings.costPerMinute).toFixed(2)}</span>
          </div>
          <div className="sim-total border-t pt-2 mt-2">
            <strong>Total Estimado</strong>
            <strong className="text-accent">${simTotal.toFixed(2)} MXN</strong>
          </div>
          <p className="commission-note text-[10px] mt-2 opacity-60">
            * Se aplicará 10% de comisión a partir del 6to viaje.
          </p>
        </div>
      </div>

      <style>{`
        .fare-settings-container {
          padding: 24px;
          border-radius: 20px;
          margin-bottom: 20px;
        }
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }
        .input-group-premium {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .input-group-premium label {
          font-size: 0.75rem;
          font-weight: 600;
          opacity: 0.8;
        }
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .currency {
          position: absolute;
          left: 12px;
          font-weight: 600;
          color: var(--accent);
        }
        .input-wrapper input {
          width: 100%;
          padding: 12px 12px 12px 28px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: white;
          font-size: 1.1rem;
          font-weight: 700;
        }
        .input-group-premium small {
          font-size: 0.65rem;
          opacity: 0.5;
        }
        .simulator-section {
          padding: 16px;
          border-radius: 16px;
          background: rgba(0,0,0,0.2);
        }
        .sim-control {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 12px;
        }
        .sim-control input[type="range"] {
          accent-color: var(--accent);
        }
        .sim-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          margin-bottom: 4px;
          opacity: 0.8;
        }
        .sim-total {
          display: flex;
          justify-content: space-between;
          font-size: 1.1rem;
        }
        .error-badge {
          background: rgba(255, 59, 48, 0.2);
          color: #ff3b30;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          margin-top: 12px;
          border: 1px solid rgba(255, 59, 48, 0.3);
        }
        .btn-primary.success {
          background: #34c759;
        }
      `}</style>
    </div>
  );
}
