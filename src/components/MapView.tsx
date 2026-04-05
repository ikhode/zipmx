import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  pickupLocation?: [number, number];
  dropoffLocation?: [number, number];
  stops?: [number, number][];
  selectingLocation?: boolean;
  onLocationSelected?: (loc: [number, number]) => void;
  nearbyDrivers?: { id: string, position: [number, number], type: string }[];
}

export function MapView({
  center = [19.4326, -99.1332],
  zoom = 13,
  pickupLocation,
  dropoffLocation,
  stops = [],
  selectingLocation = false,
  onLocationSelected,
  nearbyDrivers = []
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const routeDashRef = useRef<L.Polyline | null>(null);
  const driverMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  const lastPosRef = useRef<[number, number] | null>(null);

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

    map.on('moveend', () => {
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

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update nearby driver markers
  useEffect(() => {
    if (!mapRef.current) return;

    const currentIds = new Set(nearbyDrivers.map(d => d.id));

    driverMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        driverMarkersRef.current.delete(id);
      }
    });

    nearbyDrivers.forEach(driver => {
      let marker = driverMarkersRef.current.get(driver.id);
      if (!marker) {
        marker = L.marker(driver.position, {
          icon: L.icon({
            iconUrl: driver.type === 'moto' ? 'https://zipp.inteligent.software/icons/mototaxi_3d_icon_1775323676892.png' : 'https://zipp.inteligent.software/icons/taxi_3d_icon_1775323650355.png',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          }),
          zIndexOffset: 100
        }).addTo(mapRef.current!);
        driverMarkersRef.current.set(driver.id, marker);
      } else {
        marker.setLatLng(driver.position);
      }
    });
  }, [nearbyDrivers]);

  // --- INTELLIGENT AUTO-FOCUS ---
  useEffect(() => {
    if (!mapRef.current || !center) return;
    
    const currCenter = mapRef.current.getCenter();
    const distance = Math.sqrt(
      Math.pow(currCenter.lat - center[0], 2) + 
      Math.pow(currCenter.lng - center[1], 2)
    );

    // Only fly if the change is significant (likely a programmatic state change)
    if (distance > 0.001 || Math.abs(mapRef.current.getZoom() - zoom) > 0.5) {
      // Calculate offset for super-app "bottom sheet" center logic
      // We want the point of interest to be at 35% from the top
      const size = mapRef.current.getSize();
      const targetPoint = L.point(size.x / 2, size.y * 0.35);
      const targetLatLng = mapRef.current.containerPointToLatLng(targetPoint);
      
      // We adjust the flyTo actual center to put the coords at the visual 35% mark
      const latOffset = center[0] - targetLatLng.lat;
      const lngOffset = center[1] - targetLatLng.lng;
      
      mapRef.current.flyTo(
        [center[0] + latOffset, center[1] + lngOffset], 
        zoom, 
        { duration: 1.2, easeLinearity: 0.1 }
      );
    }
  }, [center, zoom]);

  useEffect(() => {
    if (!mapRef.current) return;
    
    mapRef.current.invalidateSize();

    if (pickupMarkerRef.current) mapRef.current.removeLayer(pickupMarkerRef.current);
    if (dropoffMarkerRef.current) mapRef.current.removeLayer(dropoffMarkerRef.current);
    if (routeLineRef.current) mapRef.current.removeLayer(routeLineRef.current);
    if (routeDashRef.current) mapRef.current.removeLayer(routeDashRef.current);
    
    pickupMarkerRef.current = null;
    dropoffMarkerRef.current = null;
    routeLineRef.current = null;
    routeDashRef.current = null;

    if (pickupLocation) {
      pickupMarkerRef.current = L.marker(pickupLocation, {
        icon: L.divIcon({
          className: 'pickup-marker-v2',
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
        }),
        zIndexOffset: 1000
      }).addTo(mapRef.current);
    }

    if (dropoffLocation) {
      dropoffMarkerRef.current = L.marker(dropoffLocation, {
        icon: L.divIcon({
          className: 'dropoff-marker-v2',
          html: `<div class="marker-container-v2">
                  <div class="dropoff-pin-black"></div>
                  <div class="marker-label-glass">
                    <span class="marker-text">Destino</span>
                  </div>
                 </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
        zIndexOffset: 1000
      }).addTo(mapRef.current);
    }

    if (pickupLocation && dropoffLocation) {
        const coords = [pickupLocation, ...stops, dropoffLocation]
          .map(p => `${p![1]},${p![0]}`)
          .join(';');
        
        const url = `/api/routing/route?coords=${coords}`;
        const fetchRoute = (attempt = 1) => {
          fetch(url)
            .then(async res => {
              const contentType = res.headers.get('content-type');
              if (!res.ok || !contentType || !contentType.includes('application/json')) {
                const text = await res.text();
                throw new Error(`Status ${res.status}: ${text.substring(0, 50)}`);
              }
              return res.json();
            })
            .then(data => {
              if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates && mapRef.current) {
                const roadPoints = data.routes[0].geometry.coordinates.map((p: [number, number]) => [p[1], p[0]] as [number, number]);
                
                if (routeLineRef.current) mapRef.current.removeLayer(routeLineRef.current);
                if (routeDashRef.current) mapRef.current.removeLayer(routeDashRef.current);

                const bounds = L.latLngBounds([pickupLocation!, ...stops, dropoffLocation!]);
                // fitBounds with extra bottom padding to account for the service selection sheet
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
              if (attempt < 2) {
                console.log(`Routing fetch failed, retrying in 2s...`);
                setTimeout(() => fetchRoute(attempt + 1), 2000);
              } else {
                console.warn("Routing Error after retry:", err.message);
              }
            });
        };

        fetchRoute();
    }
  }, [pickupLocation, dropoffLocation, stops]);

  return (
    <div className="map-wrapper-inner">
      <div ref={containerRef} className="map-container" />
      {selectingLocation && (
        <div className="center-pin-wrapper">
          <div className="pin-head"></div>
          <div className="pin-stem"></div>
          <div className="pin-shadow-dot"></div>
        </div>
      )}
    </div>
  );
}
