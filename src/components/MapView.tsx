import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  pickupLocation?: [number, number] | null;
  dropoffLocation?: [number, number] | null;
  driverLocation?: [number, number] | null;
  stops?: [number, number][];
  selectingLocation?: boolean;
  onLocationSelected?: (loc: [number, number]) => void;
  onMapInteraction?: () => void;
  nearbyDrivers?: { id: string, position: [number, number], type: string }[];
  /** Incrementar este valor fuerza un flyTo inmediato al `center` actual */
  flyToTrigger?: number;
}

export function MapView({
  center = [18.9113, -103.8743],
  zoom = 13,
  pickupLocation,
  dropoffLocation,
  driverLocation,
  stops = [],
  selectingLocation = false,
  onLocationSelected,
  onMapInteraction,
  nearbyDrivers = [],
  flyToTrigger = 0,
}: MapViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const routeDashRef = useRef<L.Polyline | null>(null);
  const driverLayerRef = useRef<L.LayerGroup | null>(null);
  const driverMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  // Siempre mantiene el último center/zoom para el flyToTrigger
  const centerRef = useRef<[number, number]>(center);
  const zoomRef = useRef<number>(zoom);
  centerRef.current = center;
  zoomRef.current = zoom;

  const lastPosRef = useRef<[number, number] | null>(null);
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const routeRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);



  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CARTO'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('movestart', () => {
      setIsDragging(true);
      if (onMapInteraction) onMapInteraction();
    });
    
    map.on('moveend', () => {
      setIsDragging(false);
      const size = map.getSize();
      const targetPoint = L.point(size.x / 2, size.y * 0.35);
      const c = map.containerPointToLatLng(targetPoint);
      
      if (!lastPosRef.current || 
          Math.abs(lastPosRef.current[0] - c.lat) > 0.000001 || 
          Math.abs(lastPosRef.current[1] - c.lng) > 0.000001) {
        lastPosRef.current = [c.lat, c.lng];
        if (onLocationSelected) {
          onLocationSelected([c.lat, c.lng]);
        }
      }
    });

    driverLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (routeRetryTimeoutRef.current) {
        clearTimeout(routeRetryTimeoutRef.current);
      }
      map.remove();

      mapRef.current = null;
      driverLayerRef.current = null;
    };
  }, []);


  // Update nearby driver markers
  useEffect(() => {
    if (!mapRef.current || !driverLayerRef.current) return;

    const currentIds = new Set(nearbyDrivers.map(d => d.id));

    // Clear ghost markers
    driverMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        driverLayerRef.current?.removeLayer(marker);
        driverMarkersRef.current.delete(id);
      }
    });

    // Update or add markers
    nearbyDrivers.forEach(driver => {
      let marker = driverMarkersRef.current.get(driver.id);
      if (!marker) {
        marker = L.marker(driver.position, {
          icon: L.icon({
            iconUrl: driver.type === 'moto' 
              ? '/icons/mototaxi_3d_icon_1775323676892.png' 
              : '/icons/taxi_3d_icon_1775323650355.png',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          }),
          zIndexOffset: 100
        }).addTo(driverLayerRef.current!);
        driverMarkersRef.current.set(driver.id, marker);
      } else {
        const currentLatLng = marker.getLatLng();
        if (currentLatLng.lat !== driver.position[0] || currentLatLng.lng !== driver.position[1]) {
          marker.setLatLng(driver.position);
        }
      }
    });
  }, [nearbyDrivers]);


  // --- INTELLIGENT AUTO-FOCUS ---
  // En modo selección el usuario arrastra el mapa libremente,
  // por eso deshabilitamos el auto-focus para evitar el loop de feedback.
  useEffect(() => {
    if (!mapRef.current || !center || selectingLocation) return;
    
    const map = mapRef.current;
    const currCenter = map.getCenter();
    const distance = L.latLng(currCenter).distanceTo(L.latLng(center));

    // Only fly if the change is significant (likely a programmatic state change)
    if (distance > 50 || Math.abs(map.getZoom() - zoom) > 0.5) {
      const size = map.getSize();
      const targetPoint = L.point(size.x / 2, size.y * 0.35);
      const centerPoint = L.point(size.x / 2, size.y / 2);
      const pixelOffset = targetPoint.subtract(centerPoint);
      
      const projectedTarget = map.project(center, zoom);
      const projectedCenter = projectedTarget.subtract(pixelOffset);
      const targetCenterLatLng = map.unproject(projectedCenter, zoom);
      
      map.flyTo(targetCenterLatLng, zoom, { duration: 1.2, easeLinearity: 0.1 });
    }
  }, [center, zoom, selectingLocation]);

  // --- FORCED FLY-TO (when entering map selection mode) ---
  useEffect(() => {
    if (!mapRef.current || flyToTrigger === 0) return;

    const c = centerRef.current;
    const z = zoomRef.current;
    const map = mapRef.current;

    const size = map.getSize();
    const targetPoint = L.point(size.x / 2, size.y * 0.35);

    // Calculate the pixel offset from center to our target point
    const centerPoint = L.point(size.x / 2, size.y / 2);
    const pixelOffset = targetPoint.subtract(centerPoint);

    // Project target LatLng to pixel coordinate at the target zoom
    const projectedTarget = map.project(c, z);
    // Subtract pixel offset to find the corresponding map center projected coordinate
    const projectedCenter = projectedTarget.subtract(pixelOffset);
    // Unproject to get the final map center LatLng
    const targetCenterLatLng = map.unproject(projectedCenter, z);

    map.flyTo(targetCenterLatLng, z, { duration: 1.0, easeLinearity: 0.1 });
  // Solo se dispara cuando flyToTrigger cambia - lee center/zoom por refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToTrigger]);

  // Marker Lifecycle: Update pickup and dropoff markers
  useEffect(() => {
    if (!mapRef.current) return;

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }
    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
      dropoffMarkerRef.current = null;
    }

    if (pickupLocation) {
      pickupMarkerRef.current = L.marker(pickupLocation, {
        icon: L.divIcon({
          className: 'pickup-marker-v2',
          isMarker: true,
          html: `<div class="marker-container-v2">
                  <div class="pulse-container">
                    <div class="pulse-ring"></div>
                    <div class="pulse-center"></div>
                  </div>
                  <div class="marker-label-glass">
                    <span class="marker-eta">6 min</span>
                    <span class="marker-text">Recogida</span>
                  </div>
                 </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        } as any),
        zIndexOffset: 1000
      }).addTo(mapRef.current);
    }

    if (dropoffLocation) {
      dropoffMarkerRef.current = L.marker(dropoffLocation, {
        icon: L.divIcon({
          className: 'dropoff-marker-v2',
          isMarker: true,
          html: `<div class="marker-container-v2">
                  <div class="dropoff-pin-black"></div>
                  <div class="marker-label-glass">
                    <span class="marker-text">Destino</span>
                  </div>
                 </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        } as any),
        zIndexOffset: 1000
      }).addTo(mapRef.current);
    }
  }, [pickupLocation, dropoffLocation]);

  const driverMarkerRef = useRef<L.Marker | null>(null);
  const lastFocusTypeRef = useRef<string>('');

  // Driver Marker Layer
  useEffect(() => {
    if (!mapRef.current) return;
    
    if (driverLocation) {
      if (!driverMarkerRef.current) {
        const taxiIcon = L.icon({
          iconUrl: '/icons/taxi_3d_icon_1775323650355.png',
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        });
        driverMarkerRef.current = L.marker(driverLocation, { icon: taxiIcon }).addTo(mapRef.current);
      } else {
        driverMarkerRef.current.setLatLng(driverLocation);
      }
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }
  }, [driverLocation]);

  // Auto-Focus Intelligence (Optimized to prevent infinite loops)
  useEffect(() => {
    if (!mapRef.current || selectingLocation) return;
    
    // Determine the current "Focus Context"
    const hasDriver = !!driverLocation;
    const hasPickup = !!pickupLocation;
    const hasDropoff = !!dropoffLocation;
    const numStops = stops?.length || 0;

    // We create a unique key for this "phase" of the ride
    const currentFocusType = `${hasDriver}:${hasPickup}:${hasDropoff}:${numStops}`;
    
    // CRITICAL: If the phase hasn't changed, we don't trigger auto-focus.
    // This prevents the map from re-zooming every time the driver moves.
    if (currentFocusType === lastFocusTypeRef.current) return;
    
    // If everything is gone, reset and return
    if (!hasDriver && !hasPickup && !hasDropoff) {
      lastFocusTypeRef.current = '';
      return;
    }

    lastFocusTypeRef.current = currentFocusType;
    const targets: L.LatLngExpression[] = [];
    const map = mapRef.current;
    
    if (driverLocation) {
      targets.push(driverLocation);
      if (pickupLocation) targets.push(pickupLocation);
      else if (dropoffLocation) targets.push(dropoffLocation);
    } else if (pickupLocation && dropoffLocation) {
      targets.push(pickupLocation);
      targets.push(dropoffLocation);
      if (stops?.length) stops.forEach(s => targets.push(s));
    }

    if (targets.length >= 2) {
       const bounds = L.latLngBounds(targets);
       map.fitBounds(bounds, { 
         padding: [80, 80],
         maxZoom: 16,
         animate: true
       });
    } else if (targets.length === 1) {
       map.setView(targets[0], 16, { animate: true });
    }
  }, [driverLocation, pickupLocation, dropoffLocation, stops, selectingLocation]);

  // Route Lifecycle: Update routing and polylines
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Cleanup previous routing attempts
    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
    }
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
    if (routeDashRef.current) {
      routeDashRef.current.remove();
      routeDashRef.current = null;
    }
    if (routeRetryTimeoutRef.current) {
      clearTimeout(routeRetryTimeoutRef.current);
      routeRetryTimeoutRef.current = null;
    }


    if (pickupLocation && dropoffLocation) {
        const coords = [pickupLocation, ...stops, dropoffLocation]
          .map(p => `${p![1]},${p![0]}`)
          .join(';');
        
        const controller = new AbortController();
        routeAbortControllerRef.current = controller;

        const url = `/api/routing/route?coords=${coords}`;

        const fetchRoute = (attempt = 1) => {
          if (controller.signal.aborted) return;

          fetch(url, { signal: controller.signal })
            .then(async res => {
              const contentType = res.headers.get('content-type');
              if (!res.ok || !contentType || !contentType.includes('application/json')) {
                const text = await res.text();
                throw new Error(`Status ${res.status}: ${text.substring(0, 50)}`);
              }
              return res.json();
            })
            .then(data => {
              if (controller.signal.aborted || !mapRef.current) return;

              if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
                const roadPoints = data.routes[0].geometry.coordinates.map((p: [number, number]) => [p[1], p[0]] as [number, number]);
                
                const bounds = L.latLngBounds([pickupLocation!, ...stops, dropoffLocation!]);


                mapRef.current.fitBounds(bounds, { 
                  paddingBottomRight: [40, 380], 
                  paddingTopLeft: [40, 100],
                  maxZoom: 16 
                });

                routeLineRef.current = L.polyline(roadPoints, {
                  color: '#00D1FF',
                  weight: 5,
                  opacity: 0.9,
                  lineJoin: 'round',
                }).addTo(mapRef.current);

                routeDashRef.current = L.polyline(roadPoints, {
                  color: '#FFFFFF',
                  weight: 2,
                  dashArray: '8, 12',
                  opacity: 0.7,
                }).addTo(mapRef.current);
              }
            })
            .catch(err => {
              if (err.name === 'AbortError') return;
              if (attempt < 2 && !controller.signal.aborted) {
                console.log(`Routing fetch failed, retrying in 2s...`);
                routeRetryTimeoutRef.current = setTimeout(() => {
                  routeRetryTimeoutRef.current = null;
                  fetchRoute(attempt + 1);
                }, 2000);
              } else {

                console.warn("Routing Error after retry:", err.message);
              }
            });
        };

        fetchRoute();
    }
  }, [pickupLocation, dropoffLocation, stops]);

  // Size Lifecycle: handle container shifts
  useEffect(() => {
    if (!mapRef.current || !containerRef.current) return;
    
    // debounced invalidate and fit-bounds if necessary
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);


  return (
    <div className="map-wrapper-inner">
      <div ref={containerRef} className="map-container" />
      {selectingLocation && (
        <div className={`center-pin-wrapper ${isDragging ? 'is-moving' : ''}`}>
          <div className="pin-head"></div>
          <div className="pin-stem"></div>
          <div className="pin-shadow-dot"></div>
        </div>
      )}
    </div>
  );
}
