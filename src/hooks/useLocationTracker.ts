import { useEffect, useRef, useState, useCallback } from 'react';

export function useLocationTracker(
  _mode: 'passenger' | 'driver', 
  userId?: string, 
  isOnline?: boolean,
  onRideUnavailable?: (rideId: string) => void
) {
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connect = useCallback(() => {
    if (wsRef.current) return;

    // Determine the protocol (ws vs wss) based on the location
    // In dev (vite + wrangler proxy), it should connect to the proxy port
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws`;

    console.log('[useLocationTracker] Connecting to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'initial_drivers') {
          setNearbyDrivers(data.drivers || []);
        } else if (data.type === 'driver_updated') {
          setNearbyDrivers(prev => {
            const filtered = prev.filter(d => d.id !== data.driver.id);
            return [...filtered, data.driver];
          });
        } else if (data.type === 'driver_removed') {
          setNearbyDrivers(prev => prev.filter(d => d.id !== data.id));
        } else if (data.type === 'ride_unavailable') {
          onRideUnavailable?.(data.id);
        }
      } catch (err) {
        console.error('[useLocationTracker] WS Message Error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[useLocationTracker] WS Closed. Reconnecting...');
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('[useLocationTracker] WS Error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const updateLocation = useCallback((lat: number, lng: number, vehicleType: string, isBusy: boolean = false) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userId && isOnline) {
      wsRef.current.send(JSON.stringify({
        type: 'update_location',
        id: userId,
        lat,
        lng,
        vehicleType,
        status: isBusy ? 'busy' : 'available'
      }));
    }
  }, [userId, isOnline]);

  return { nearbyDrivers, updateLocation };
}
