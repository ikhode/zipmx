import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import APIClient, { APIUser } from './lib/api';
import { MapView } from './components/MapView';
import { RideRequestSheet } from './components/RideRequestSheet';

type SelectionType = 'none' | 'pickup' | 'dropoff' | { type: 'stop', index: number };

import { PassengerHome } from './components/PassengerHome';
import { PromoDetailsSheet } from './components/PromoDetailsSheet';
import { AccountMenuSheet } from './components/AccountMenuSheet';
import { DriverModeSheet } from './components/DriverModeSheet';
import { Auth } from './components/Auth';
import { BottomSheet } from './components/BottomSheet';
import { VerificationSheet } from './components/VerificationSheet';
import { StatusBanner } from './components/StatusBanner';
import { QuickAuthSplash } from './components/QuickAuthSplash';
import { reverseGeocode, formatAddress } from './lib/geocoding';
import { useToast } from './components/ToastProvider';
import { triggerHaptic } from './lib/haptics';
import { useLocationTracker } from './hooks/useLocationTracker';
import { LegalPage } from './components/Legal';

type AppMode = 'passenger' | 'driver';

// --- Memoized Sub-components ---

const MapSelectionOverlay = React.memo(({ 
  tempAddress, onConfirm, onCancel 
}: { 
  tempAddress: string, onConfirm: () => void, onCancel: () => void 
}) => {
  return (
    <div className="map-selection-minimal">
      <button className="minimal-back-btn interactive-scale" onClick={() => { triggerHaptic('light'); onCancel(); }}>←</button>
      <div className="center-pin-minimal"></div>
      
      <div className="selection-sheet-minimal">
        <div className="selection-address-mini">{tempAddress}</div>
        <button className="confirm-button-minimal interactive-scale" onClick={() => { triggerHaptic('success'); onConfirm(); }}>
          Confirmar ubicación
        </button>
      </div>
    </div>
  );
});

const DEFAULT_LOCATION: [number, number] = [18.9113, -103.8743];

const PrivacyNotice = ({ onAccept }: { onAccept: () => void }) => (
  <div className="privacy-notice-overlay fade-in">
    <div className="privacy-card-premium stagger-in">
      <div className="privacy-icon">📍</div>
      <h3>Tu privacidad es clave</h3>
      <p>
        Zipp utiliza tu ubicación en <b>segundo plano</b> para:
      </p>
      <ul className="privacy-list">
        <li>Conectarte con conductores cercanos.</li>
        <li>Permitir el seguimiento del viaje en tiempo real por seguridad.</li>
        <li>Calcular tarifas precisas basadas en la distancia.</li>
      </ul>
      <p className="privacy-footer">
        Tus datos están protegidos y solo se usan para mejorar tu experiencia de movilidad.
      </p>
      <button className="confirm-primary-btn" onClick={onAccept}>
        Entendido y aceptar
      </button>
    </div>
  </div>
);

export default function App() {
  const { showToast } = useToast();
  const [session, setSession] = useState<{ user: APIUser } | null>(null);
  const [mode, setMode] = useState<AppMode>('passenger');
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionType>('none');
  const [planningStarted, setPlanningStarted] = useState(false);
  
  // Refs to fix stale closures in watchPosition
  const planningStartedRef = useRef(planningStarted);
  const selectionModeRef = useRef(selectionMode);
  
  useEffect(() => { planningStartedRef.current = planningStarted; }, [planningStarted]);
  useEffect(() => { selectionModeRef.current = selectionMode; }, [selectionMode]);

  const [showPromoDetails, setShowPromoDetails] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [currentRideType, setCurrentRideType] = useState<'ride' | 'errand' | 'taxi' | 'mototaxi'>('ride');

  // User's real GPS location
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [privacyAccepted, setPrivacyAccepted] = useState(() => localStorage.getItem('zipp_privacy_accepted') === 'true');
  
  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  
  // Locations State
  const [pickupLocation, setPickupLocation] = useState<[number, number] | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [dropoffLocation, setDropoffLocation] = useState<[number, number] | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<string>('');
  const [stops, setStops] = useState<{ position: [number, number], address: string }[]>([]);
  
  // Temp state for map selection
  const [tempLocation, setTempLocation] = useState<[number, number] | null>(null);
  const [tempAddress, setTempAddress] = useState<string>('Buscando dirección...');
  // Ubicación inicial al entrar al modo selección (NO se actualiza al arrastrar el mapa)
  const [selectionInitialLocation, setSelectionInitialLocation] = useState<[number, number] | null>(null);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [hasActiveRide, setHasActiveRide] = useState(false);
  const [showVerificationSheet, setShowVerificationSheet] = useState<{ type: 'passenger' | 'driver' } | null>(null);
  const [showQuickAuth, setShowQuickAuth] = useState(false);
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  const [quickAuthType, setQuickAuthType] = useState<'passenger' | 'driver'>('passenger');
  const [flyToTrigger, setFlyToTrigger] = useState(0);
  const [driverIsOnline, setDriverIsOnline] = useState(false);
  const [showLegal, setShowLegal] = useState<string | null>(null);
  const lastSelectionMode = React.useRef<SelectionType>('none');
  
  // Real-time Tracker
  const { nearbyDrivers: realTimeDrivers, updateLocation } = useLocationTracker(
    mode, 
    session?.user?.id, 
    mode === 'driver' && driverIsOnline
  );

  const onLoginRequired = (type: 'passenger' | 'driver') => {
    setQuickAuthType(type);
    setShowAuthSheet(true);
    triggerHaptic('medium');
  };

  const handleOpenAuth = useCallback(() => {
    setShowAuthSheet(true);
    triggerHaptic('medium');
  }, []);

  // User's last geocoded location to avoid excessive API calls
  const lastGeocodedLocation = useRef<[number, number] | null>(null);

  // --- Geolocation: get user's real position and track it ---
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoLoading(false);
      return;
    }

    // Use watchPosition to continuously get high accuracy and follow the user
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        
        // Update pickup to current location if not set yet OR if not planning a ride
        setPickupLocation((prevPickup) => {
          const isPlanning = planningStartedRef.current;
          const sMode = selectionModeRef.current;

          if (!prevPickup || (!isPlanning && sMode === 'none')) {
            // Re-center map if this is the first real fix
            if (!prevPickup) setFlyToTrigger(prev => prev + 1);
            
            // Only update address if not in map selection and user has moved significantly (> ~50m)
            if (sMode === 'none' && !isPlanning) {
              const last = lastGeocodedLocation.current;
              const hasMovedSignificantly = !last || (Math.abs(last[0] - loc[0]) > 0.0005 || Math.abs(last[1] - loc[1]) > 0.0005);
              
              if (hasMovedSignificantly) {
                lastGeocodedLocation.current = loc;
                reverseGeocode(loc[0], loc[1]).then((res) => {
                  if (res) setPickupAddress(formatAddress(res));
                  else if (!pickupAddress) setPickupAddress('Mi ubicación actual');
                });
              }
            }
            return loc;
          }
          return prevPickup;
        });

        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    APIClient.getProfile().then(user => setSession(user ? { user } : null));

    // --- Hash Based Routing ---
    const handleHashSync = () => {
      const hash = window.location.hash;
      if (hash === '#/profile') {
          setShowAccountMenu(true);
      } else if (hash === '#/driver') {
          setMode('driver');
          setPlanningStarted(false);
      } else if (hash === '#/passenger') {
          setMode('passenger');
      } else if (hash === '#/') {
          setShowAccountMenu(false);
      }
    };

    handleHashSync();
    window.addEventListener('popstate', handleHashSync);

    window.addEventListener('open-auth', handleOpenAuth);
    return () => {
        window.removeEventListener('open-auth', handleOpenAuth);
        window.removeEventListener('popstate', handleHashSync);
    };
  }, [handleOpenAuth]);

  // Handle Splash Screen
  useEffect(() => {
    const timer1 = setTimeout(() => setSplashFading(true), 2400);
    const timer2 = setTimeout(() => setShowSplash(false), 2800);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  // Sync state to hash
  useEffect(() => {
    let hash = '#/';
    if (showAccountMenu) hash = '#/profile';
    else if (mode === 'driver') hash = '#/driver';
    else if (mode === 'passenger') hash = '#/passenger';

    if (window.location.hash !== hash) {
       window.history.pushState(null, '', hash);
    }
  }, [mode, showAccountMenu]);

  // Update driver location on server whenever userLocation changes and we are a driver
  useEffect(() => {
    if (mode === 'driver' && driverIsOnline && userLocation) {
       // Fetch vehicle type from somewhere or default to car
       // For now using 'car', we might want to store this in state
       updateLocation(userLocation[0], userLocation[1], 'car');
    }
  }, [mode, driverIsOnline, userLocation, updateLocation]);


  // Flag to know if we have already successfully centered on a real location for the current selection mode
  const selectionHasRealLocation = useRef(false);
  // Flag to track if the user has manually moved the map in the current selection session
  const userInteractedRef = useRef(false);

  const handleMapInteraction = useCallback(() => {
    userInteractedRef.current = true;
  }, []);

  // Set initial temp location when entering selection mode
  useEffect(() => {
    const isSameMode = (a: SelectionType, b: SelectionType) => {
      if (typeof a === 'object' && typeof b === 'object') return a.type === b.type && a.index === b.index;
      return a === b;
    };

    if (selectionMode !== 'none') {
      const modeChanged = !isSameMode(lastSelectionMode.current, selectionMode);
      
      // Reset interaction flag on mode change
      if (modeChanged) {
        userInteractedRef.current = false;
        selectionHasRealLocation.current = false;
      }
      
      // If user interacted manually, WE DO NOT AUTO-FOLLOW anymore for this session
      if (userInteractedRef.current && selectionHasRealLocation.current) return;

      lastSelectionMode.current = selectionMode;

      let initial: [number, number] | null = null;
      let initialAddr = 'Buscando dirección...';

      if (selectionMode === 'pickup') {
        initial = userLocation || pickupLocation;
        initialAddr = pickupAddress || 'Mi ubicación';
      } else if (selectionMode === 'dropoff') {
        initial = dropoffLocation || userLocation || pickupLocation;
        initialAddr = dropoffAddress || '¿A dónde vas?';
      } else if (typeof selectionMode === 'object' && selectionMode.type === 'stop') {
        initial = stops[selectionMode.index]?.position || userLocation || pickupLocation;
        initialAddr = stops[selectionMode.index]?.address || 'Nueva parada';
      }

      // If we got a real location from state (not using the fallback), mark as real
      if (initial) {
        selectionHasRealLocation.current = true;
      }

      const loc: [number, number] = initial || DEFAULT_LOCATION;
      setTempLocation(loc);
      setTempAddress(initialAddr);
      setSelectionInitialLocation(loc);
      setFlyToTrigger(prev => prev + 1);
    } else {
      lastSelectionMode.current = 'none';
      selectionHasRealLocation.current = false;
      userInteractedRef.current = false;
      setSelectionInitialLocation(null);
      setTempLocation(null);
      setTempAddress('Buscando dirección...');
    }
  }, [selectionMode, pickupLocation, dropoffLocation, userLocation, pickupAddress, dropoffAddress, stops]);


  // Debounced geocoding for temp selection
  useEffect(() => {
    if (!tempLocation || selectionMode === 'none') return;
    
    const timer = setTimeout(() => {
      reverseGeocode(tempLocation[0], tempLocation[1]).then((res) => {
        if (res) setTempAddress(formatAddress(res));
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [tempLocation, selectionMode]);

  const confirmSelection = useCallback(() => {
    if (!tempLocation) return;
    
    if (selectionMode === 'pickup') {
      setPickupLocation(tempLocation);
      setPickupAddress(tempAddress);
    } else if (selectionMode === 'dropoff') {
      setDropoffLocation(tempLocation);
      setDropoffAddress(tempAddress);
    } else if (typeof selectionMode === 'object' && selectionMode.type === 'stop') {
      const newStops = [...stops];
      newStops[selectionMode.index] = { position: tempLocation, address: tempAddress };
      setStops(newStops);
    }
    setSelectionMode('none');
  }, [tempLocation, tempAddress, selectionMode, stops]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (selectionMode !== 'none' && selectionInitialLocation) return selectionInitialLocation;
    return pickupLocation || userLocation || DEFAULT_LOCATION;
  }, [selectionMode, selectionInitialLocation, pickupLocation, userLocation]);

  // --- Passenger Handlers ---
  const handleStartPlanning = useCallback((_field?: 'pickup' | 'dropoff') => {
    triggerHaptic('light');
    setPlanningStarted(true);
  }, []);
  const handleSelectService = useCallback((type: 'ride' | 'errand' | 'taxi' | 'mototaxi') => {
    triggerHaptic('medium');
    setCurrentRideType(type);
    setPlanningStarted(true);
  }, []);
  const handlePromoClick = useCallback(() => {
    triggerHaptic('light');
    setShowPromoDetails(true);
  }, []);
  const handleAccountMenuOpen = useCallback(() => {
    triggerHaptic('medium');
    setShowAccountMenu(true);
  }, []);
  const handleModeSelectorClose = useCallback(() => setShowModeSelector(false), []);
  const handleAccountMenuClose = useCallback(() => setShowAccountMenu(false), []);
  const handlePromoClose = useCallback(() => setShowPromoDetails(false), []);

  const handleResetPlanning = useCallback(() => {
    setPlanningStarted(false);
    setIsHeaderHidden(false);
    setPickupLocation(null);
    setPickupAddress('');
    setDropoffLocation(null);
    setDropoffAddress('');
    setStops([]);
    // Reset map to user location if available
    if (userLocation) {
      setFlyToTrigger(prev => prev + 1);
    }
  }, [userLocation]);

  const handlePickupChange = useCallback((loc: [number, number] | null, addr?: string) => {
    if (loc) setPickupLocation(loc);
    if (addr) setPickupAddress(addr);
  }, []);

  const handleDropoffChange = useCallback((loc: [number, number] | null, addr?: string) => {
    if (loc) setDropoffLocation(loc);
    if (addr) setDropoffAddress(addr);
  }, []);

  const handleUseMyLocation = useCallback(async (field: 'pickup' | 'dropoff') => {
    const loc = userLocation;
    if (!loc) return;
    const res = await reverseGeocode(loc[0], loc[1]);
    const addr = res ? formatAddress(res) : 'Mi ubicación actual';
    if (field === 'pickup') {
      setPickupLocation(loc);
      setPickupAddress(addr);
    } else {
      setDropoffLocation(loc);
      setDropoffAddress(addr);
    }
  }, [userLocation]);

  const handleSwitchMode = useCallback(() => {
    if (hasActiveRide) {
       showToast("No puedes cambiar de modo con un viaje activo", "error");
       return;
    }
    
    triggerHaptic('medium');
    
    if (mode === 'passenger') {
       if (session && !session.user.verified) {
          setShowAccountMenu(false);
          setShowVerificationSheet({ type: 'driver' });
       } else {
          setMode('driver');
          setPlanningStarted(false);
          setShowAccountMenu(false);
       }
    } else {
       setMode('passenger');
       setShowAccountMenu(false);
    }
  }, [hasActiveRide, mode, session, showToast]);

  return (
    <div className={`app-container ${mode === 'passenger' && !pickupLocation && !dropoffLocation && selectionMode === 'none' ? 'is-home' : ''}`}>
      <StatusBanner />
      <div className="map-wrapper">
        <MapView 
          center={mapCenter}
          zoom={15}
          pickupLocation={pickupLocation || undefined}
          dropoffLocation={dropoffLocation || undefined}
          stops={stops.map(s => s.position)}
          selectingLocation={selectionMode !== 'none'}
          onLocationSelected={(loc) => setTempLocation(loc)}
          onMapInteraction={handleMapInteraction}
          nearbyDrivers={realTimeDrivers}
          flyToTrigger={flyToTrigger}
        />
      </div>

      {selectionMode === 'none' && (
        <div className={`zipp-premium-header ${isHeaderHidden ? 'hidden' : ''} mode-${mode}`}>
          <div className="zipp-header-left stagger-in">
            <span className="zipp-logo-text">ZIPP</span>
          </div>
          <div className="zipp-header-right stagger-in">
            {!session ? (
              <>
                <button 
                  className="zipp-login-link interactive-scale" 
                  onClick={() => { triggerHaptic('medium'); setShowAuthSheet(true); }}
                >
                  Inicia sesión
                </button>
                <button 
                  className="zipp-signup-btn interactive-scale" 
                  onClick={() => { triggerHaptic('medium'); setShowAuthSheet(true); }}
                >
                  Regístrate
                </button>
              </>
            ) : (
              <button 
                className="zipp-mode-btn interactive-scale" 
                onClick={() => { triggerHaptic('medium'); setShowModeSelector(true); }}
              >
                {mode === 'passenger' ? 'Pasajero' : 'Conductor'}
              </button>
            )}
            
            <button className="zipp-menu-btn interactive-scale" onClick={handleAccountMenuOpen}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
            </button>
          </div>
        </div>
      )}

      {selectionMode !== 'none' && (
        <MapSelectionOverlay 
          tempAddress={tempAddress}
          onConfirm={confirmSelection}
          onCancel={() => setSelectionMode('none')}
        />
      )}

       {selectionMode === 'none' && (
        <div className={`scroll-content experience-${mode}`}>
          {mode === 'passenger' ? (
            !planningStarted && !hasActiveRide ? (
              <div className="home-content" style={{ pointerEvents: 'auto' }}>
                <PassengerHome 
                  dropoffAddress={dropoffAddress}
                  onStartPlanning={handleStartPlanning}
                  onSelectService={handleSelectService}
                  onPromoClick={handlePromoClick}
                />
                <div className="home-map-preview-placeholder"></div>
              </div>
            ) : (
              <>
                <div className="scroll-spacer"></div>
                <div className="scroll-card">
                  <div className="sheet-handle-minimal"></div>
                  {!session && !hasActiveRide && (
                    <div className="guest-cta-minimal fade-in">
                       <button className="interactive-scale" onClick={() => { triggerHaptic('medium'); setShowAuthSheet(true); }}>INICIAR SESIÓN</button>
                    </div>
                  )}
                  
                  <RideRequestSheet
                    session={session}
                    initialPlanning={planningStarted}
                    onPlanningClose={handleResetPlanning}
                    pickupLocation={pickupLocation}
                    pickupAddress={pickupAddress}
                    dropoffLocation={dropoffLocation}
                    dropoffAddress={dropoffAddress}
                    stops={stops}
                    onPickupChange={handlePickupChange}
                    onDropoffChange={handleDropoffChange}
                    onStopsChange={setStops}
                    onStartMapSelection={(mode: any) => { triggerHaptic('medium'); setSelectionMode(mode); }}
                    onRideTypeChange={setCurrentRideType}
                    rideType={currentRideType}
                    onLoginRequired={() => onLoginRequired('passenger')}
                    preSelectedVehicle={currentRideType === 'taxi' || currentRideType === 'mototaxi' ? currentRideType : undefined}
                    onHeaderVisibilityChange={setIsHeaderHidden}
                    onActiveRideChange={setHasActiveRide}
                    userLocation={userLocation}
                    geoLoading={geoLoading}
                    onUseMyLocation={handleUseMyLocation}
                  />
                </div>
              </>
            )
          ) : (
             <div className="driver-focused-view">
               <DriverModeSheet 
                 session={session} 
                 onActiveRideChange={setHasActiveRide} 
                 onLoginRequired={() => onLoginRequired('driver')}
                 onOnlineChange={setDriverIsOnline}
               />
             </div>
          )}
        </div>
      )}

      {showLegal && (
        <BottomSheet
          isOpen={!!showLegal}
          onClose={() => setShowLegal(null)}
          snapPoints={[0.9]}
          initialSnap={0}
        >
          <LegalPage title={showLegal} onClose={() => setShowLegal(null)} />
        </BottomSheet>
      )}

      {showQuickAuth && (
        <QuickAuthSplash 
          userType={quickAuthType}
          onClose={() => setShowQuickAuth(false)}
          onShowFullAuth={() => {
            setShowQuickAuth(false);
            setShowAuthSheet(true);
          }}
        />
      )}

      <BottomSheet
        isOpen={showPromoDetails}
        onClose={handlePromoClose}
        snapPoints={[0.9]}
        initialSnap={0}
      >
        <PromoDetailsSheet onClose={handlePromoClose} />
      </BottomSheet>
      
      <BottomSheet
        isOpen={showAccountMenu}
        onClose={handleAccountMenuClose}
        snapPoints={[0.9]}
        initialSnap={0}
      >
        <AccountMenuSheet 
          session={session} 
          currentMode={mode}
          hasActiveRide={hasActiveRide}
          onClose={handleAccountMenuClose} 
          onSwitchMode={handleSwitchMode}
          onVerifyIdentity={() => {
            setShowAccountMenu(false);
            setShowVerificationSheet({ type: mode as 'passenger' | 'driver' });
          }}
          onUserUpdate={(user) => setSession({ user })}
        />
      </BottomSheet>

      <BottomSheet
        isOpen={showModeSelector}
        onClose={handleModeSelectorClose}
        snapPoints={[0.4]}
        initialSnap={0}
      >
        <div className="mode-selector stagger-in">
          <h3 className="mode-selector-title">Selecciona tu modo</h3>
          <div className="mode-options">
            <button
              className={`mode-option interactive-scale ${mode === 'passenger' ? 'active' : ''}`}
              onClick={() => { triggerHaptic('medium'); setMode('passenger'); setShowModeSelector(false); }}
            >
              <div className="mode-badge"></div>
              <span className="mode-icon">🚗</span>
              <span className="mode-label">Pasajero</span>
            </button>
            <button
              className={`mode-option interactive-scale ${mode === 'driver' ? 'active' : ''}`}
              onClick={() => { 
                triggerHaptic('medium');
                if (session && !session.user.verified) {
                   setShowModeSelector(false);
                   setShowVerificationSheet({ type: 'driver' });
                   return;
                }
                setMode('driver'); 
                setShowModeSelector(false); 
              }}
            >
              <div className="mode-badge"></div>
              <span className="mode-icon">👨‍✈️</span>
              <span className="mode-label">Conductor</span>
            </button>
          </div>
          
          <div className="auth-footer-minimal">
            {session && (
              <button className="cancel-link-btn interactive-scale" onClick={() => { triggerHaptic('medium'); APIClient.logout(); window.location.reload(); }}>
                Cerrar Sesión
              </button>
            )}
          </div>
        </div>
      </BottomSheet>

      {showAuthSheet && (
        <BottomSheet
          isOpen={!!showAuthSheet}
          onClose={() => setShowAuthSheet(false)}
          snapPoints={[0.85]}
          initialSnap={0}
        >
          <Auth 
            onSuccess={(user) => { setSession({ user }); setShowAuthSheet(false); }}
            onClose={() => setShowAuthSheet(false)}
            initialMode={quickAuthType}
          />
        </BottomSheet>
      )}

      <BottomSheet
        isOpen={!!showVerificationSheet}
        onClose={() => setShowVerificationSheet(null)}
        snapPoints={[0.9]}
        initialSnap={0}
      >
        {showVerificationSheet && (
          <VerificationSheet 
            type={showVerificationSheet.type}
            onClose={() => setShowVerificationSheet(null)}
            onComplete={(user) => {
               setSession({ user });
               setShowVerificationSheet(null);
               if (showVerificationSheet.type === 'driver') setMode('driver');
               triggerHaptic('success');
            }}
          />
        )}
      </BottomSheet>

      {showSplash && (
        <div className={`app-splash-screen ${splashFading ? 'fade-out' : ''}`}>
           <div className="splash-logo-container">
              <div className="splash-logo-text">Zipp</div>
              <div className="splash-loader-bar"><div className="splash-loader-progress"></div></div>
           </div>
        </div>
      )}

      {(!privacyAccepted && !showSplash) && (
        <PrivacyNotice onAccept={() => {
          localStorage.setItem('zipp_privacy_accepted', 'true');
          setPrivacyAccepted(true);
        }} />
      )}
    </div>
  );
}
