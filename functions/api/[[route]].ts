import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { jwt, sign } from 'hono/jwt';
import * as schema from '../../src/db/schema';

type Bindings = {
  DB: any;
  JWT_SECRET: string;
  MERCADOPAGO_ACCESS_TOKEN: string;
  LOCATION_TRACKER: any;
  STORAGE: any; // R2 Bucket
};

type JWTPayload = {
  id: string;
  email: string;
  exp: number;
};

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

const getSecret = (c: any): string => {
  const secret = c.env?.JWT_SECRET;
  if (secret) return secret;
  // Fallback for local dev — wrangler pages dev does not inject Pages secrets
  console.warn('[getSecret] JWT_SECRET not set — using dev fallback. Set it via: wrangler pages secret put JWT_SECRET');
  return 'dev-secret-keep-it-safe-never-use-in-prod';
};

const authGuard = (c: any, next: any) => jwt({ secret: getSecret(c), alg: 'HS256' })(c, next);

app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// WebSocket Entry point
app.all('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  // Get a single global instance for simplicity in this project
  const id = c.env.LOCATION_TRACKER.idFromName('global');
  const obj = c.env.LOCATION_TRACKER.get(id);

  return obj.fetch(c.req.raw);
});

// Geocoding Proxy
app.get('/geocoding/address', async (c) => {
  const query = c.req.query('q');
  const lat = c.req.query('lat');
  const lon = c.req.query('lon');
  
  if (!query) return c.json({ error: 'Query is required' }, 400);

  // Focus on Armería, Colima, Mexico area by default to improve local hits
  let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1&countrycodes=mx`;
  
  const d = 0.5; // Viewbox delta
  const bLat = lat ? parseFloat(lat) : 19.0148;
  const bLon = lon ? parseFloat(lon) : -104.2403;
  url += `&viewbox=${bLon-d},${bLat+d},${bLon+d},${bLat-d}&bounded=0`; // bounded=0 allows finding nearby if not in viewbox

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ZippMobilityApp/1.0 (https://zipp.inteligent.software)' }

    });
    
    if (response.status === 429) return c.json({ error: 'Rate limit exceeded' }, 429);
    
    const data = await response.json() as any[];
    if (data.length === 0) return c.json(null);

    return c.json({
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      display_name: data[0].display_name,
      address: data[0].address || {},
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/geocoding/search', async (c) => {
  const query = c.req.query('q');
  const lat = c.req.query('lat');
  const lon = c.req.query('lon');

  if (!query) return c.json([]);

  let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&countrycodes=mx`;
  
  const d = 0.5;
  const bLat = lat ? parseFloat(lat) : 19.0148;
  const bLon = lon ? parseFloat(lon) : -104.2403;
  url += `&viewbox=${bLon-d},${bLat+d},${bLon+d},${bLat-d}&bounded=0`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ZippMobilityApp/1.0 (https://zipp.inteligent.software)' }

    });
    
    if (!response.ok) return c.json([]);

    const data = await response.json() as any[];
    const results = data.map(item => ({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      display_name: item.display_name,
      address: item.address || {},
    }));

    return c.json(results);
  } catch {
    return c.json([]);
  }
});

app.get('/geocoding/reverse', async (c) => {
  const lat = c.req.query('lat');
  const lon = c.req.query('lon');

  if (!lat || !lon) return c.json({ error: 'Latitude and Longitude are required' }, 400);

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ZippMobilityApp/1.0 (https://zipp.inteligent.software)' }

    });

    if (response.status === 429) return c.json({ error: 'Rate limit exceeded' }, 429);

    const data = await response.json() as any;
    return c.json({
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      display_name: data.display_name,
      address: data.address || {},
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Storage Endpoints (R2)
app.post('/upload', authGuard, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const body = await c.req.parseBody();
    const file = body['file'] as any; // File object

    if (!file || !file.name) return c.json({ error: 'Archivo no válido' }, 400);

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const key = `uploads/${payload.id}/${fileName}`;

    await c.env.STORAGE.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' }
    });

    const url = `/api/files/${key}`;
    return c.json({ url, key });
  } catch (err: any) {
    return c.json({ error: `Error al subir: ${err.message}` }, 500);
  }
});

app.get('/files/:path{.+}', async (c) => {
  const path = c.req.param('path');
  try {
    const object = await c.env.STORAGE.get(path);
    if (!object) return c.notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    // Cache for 1 day
    headers.set('Cache-Control', 'public, max-age=86400');

    return c.body(object.body, 200, Object.fromEntries(headers.entries()));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Routing Proxy (OSRM) to avoid CORS
app.get('/routing/route', async (c) => {
  const coords = c.req.query('coords'); // format: "lon1,lat1;lon2,lat2"
  if (!coords) return c.json({ error: 'Coordinates are required' }, 400);

  // Use a more stable community-hosted OSRM server, adding an extra one as fallback
  const osrmInstances = [
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6500); // 6.5s timeout

  try {
    // Launch all fetches concurrently to resolve the fastest one
    const fetchPromises = osrmInstances.map(url => 
      fetch(url, { headers: { 'User-Agent': 'ZippMobilityApp/1.0' }, signal: controller.signal })
        .then(async res => {
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const data = await res.json();
          if (data.code !== 'Ok') throw new Error(`OSRM Error: ${data.code}`);
          return data;
        })
    );

    const fastestSuccess = await Promise.any(fetchPromises);
    return c.json(fastestSuccess);
  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'AggregateError') {
       return c.json({ error: 'Routing servers are currently unavailable or timed out.' }, 504);
    }
    return c.json({ error: 'All routing instances failed.' }, 503);
  } finally {
    clearTimeout(timeoutId);
  }
});


// Auth
app.post('/auth/signup', async (c) => {
  try {
    const { email, phone, fullName, userType } = await c.req.json();
    const db = drizzle(c.env.DB, { schema });
    const secret = getSecret(c);

    // Validation
    if (!email || !phone || !fullName || !userType) {
      return c.json({ error: 'Todos los campos son obligatorios.' }, 400);
    }

    const newUser = await db.insert(schema.users).values({
      email, phone, fullName, userType,
    }).returning();
    
    if (!newUser || newUser.length === 0) {
      throw new Error('No se pudo crear el usuario en la base de datos.');
    }

    const user = newUser[0];
    const payload: JWTPayload = { id: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 };
    const token = await sign(payload, secret, 'HS256');
    return c.json({ user, token });
  } catch (error: any) {
    const errorMsg = error?.message || 'Error desconocido';
    const causeMsg = error?.cause?.message || '';
    
    console.error('[/auth/signup] Critical Registration Error:', {
      message: errorMsg,
      cause: causeMsg
    });

    // En Drizzle D1, el error subyacente (UNIQUE constraint) a menudo se esconde en el cause.
    const fullErrorString = `${errorMsg} ${causeMsg}`.toLowerCase();

    if (fullErrorString.includes('unique constraint') || fullErrorString.includes('unique')) {
      if (fullErrorString.includes('email')) {
        return c.json({ error: 'Este correo ya está registrado.' }, 409);
      }
      if (fullErrorString.includes('phone')) {
        return c.json({ error: 'Este número de teléfono ya está registrado.' }, 409);
      }
      return c.json({ error: 'Este correo o teléfono ya está registrado.' }, 409);
    }

    if (fullErrorString.includes('jwt_secret')) {
      return c.json({ error: 'Error de configuración del servidor (JWT).' }, 500);
    }

    return c.json({ error: `Error en el registro: ${errorMsg}` }, 500);
  }
});

// Profile Management (Mandatory for Store Approval)
app.get('/profile', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, payload.id) });
  if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);
  return c.json(user);
});

app.patch('/profile', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const data = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  
  await db.update(schema.users)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, payload.id));
    
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, payload.id) });
  return c.json(user);
});

app.delete('/profile', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  
  // Complex deletion logic: anonymize or delete data
  // For now, permanent deletion as requested by Apple
  await db.delete(schema.users).where(eq(schema.users.id, payload.id));
  await db.delete(schema.drivers).where(eq(schema.drivers.id, payload.id));
  
  return c.json({ success: true, message: 'Cuenta eliminada exitosamente' });
});

// OTP Auth Endpoints
app.post('/auth/send-otp', async (c) => {
  const { phone } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  
  // App Store Reviewer Bypass
  if (phone === '+520000000000') {
    return c.json({ success: true, message: 'Código enviado con éxito (Reviewer Mode)' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  await db.insert(schema.verificationCodes).values({
    phone,
    code,
    expiresAt
  });

  // Mock SMS sending (In production combine with Twilio/Sinfonia)
  console.log(`\x1b[33m[OTP SERVICE]\x1b[0m Enviando código \x1b[1m${code}\x1b[0m al teléfono ${phone}`);
  return c.json({ success: true, message: 'Código enviado con éxito' });
});

app.post('/auth/verify-otp', async (c) => {
  // Firebase ID Token Verification & Identity Sync
  try {
    const { phone, idToken } = await c.req.json();
    if (!idToken) return c.json({ error: 'Falta el Token de Identidad' }, 400);

    const db = drizzle(c.env.DB, { schema });

    // Decoding Base64URL to JSON (Hand-rolled for Cloudflare Worker environment)
    const base64Url = idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const payload = JSON.parse(jsonPayload);

    if (payload.iss !== `https://securetoken.google.com/zipp-mx` || payload.aud !== `zipp-mx`) {
      return c.json({ error: 'Token de Firebase inválido' }, 401);
    }

    if (payload.exp < Date.now() / 1000) {
      return c.json({ error: 'Token expirado' }, 401);
    }

    const firebaseUid = payload.sub;
    const isAnonymous = payload.provider_id === 'anonymous' || (!payload.phone_number && !payload.email);
    
    // Determine the phone and email to store
    const firebasePhone = payload.phone_number || null;
    const firebaseEmail = payload.email || null;
    
    const storedPhone = firebasePhone || `anon_${firebaseUid.slice(0, 12)}`;
    const storedEmail = firebaseEmail || `user_${firebaseUid.slice(0, 8)}@zipp.app`;

    // 1. Try to find user by Firebase UID (sub)
    let user = await db.query.users.findFirst({ where: eq(schema.users.id, firebaseUid) });
    
    // 2. If not found by UID, try by Phone (if not anonymous)
    if (!user && firebasePhone) {
       user = await db.query.users.findFirst({ where: eq(schema.users.phone, firebasePhone) });
    }

    if (!user) {
      // Create new user record (with placeholder if anonymous)
      const newUser = await db.insert(schema.users).values({
        id: firebaseUid,
        email: storedEmail,
        phone: storedPhone,
        fullName: payload.name || 'Usuario Zipp',
        userType: 'passenger',
        verified: !!firebasePhone
      }).returning();
      user = newUser[0];
    } else {
      // Check for account upgrade
      const hasRealPhoneNow = !!firebasePhone;
      const hadPlaceholder = user.phone.startsWith('anon_');
      
      if ((hadPlaceholder && hasRealPhoneNow) || (!user.email && firebaseEmail)) {
        await db.update(schema.users)
          .set({ 
            phone: hasRealPhoneNow ? firebasePhone : user.phone,
            email: firebaseEmail || user.email,
            verified: hasRealPhoneNow ? true : user.verified,
            updatedAt: new Date().toISOString()
          })
          .where(eq(schema.users.id, user.id));
        
        user = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
      }
    }

    const secret = getSecret(c);
    const jwtPayload: JWTPayload = { id: user!.id, email: user!.email || '', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 };
    const token = await sign(jwtPayload, secret, 'HS256');

    return c.json({ 
      success: true, 
      user, 
      token, 
      isNewUser: user!.phone.startsWith('anon_') 
    });
  } catch (err: any) {
    console.error('Backend Firebase Integration Error:', err);
    return c.json({ error: 'Error de sincronización de identidad', details: err.message }, 500);
  }
});


app.post('/auth/login', async (c) => {
  const { email } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  const secret = getSecret(c);
  try {
    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (!user) return c.json({ error: 'User not found' }, 401);
    const payload: JWTPayload = { id: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 };
    const token = await sign(payload, secret, 'HS256');
    return c.json({ user, token });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Profile
app.get('/profile', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, payload.id) });
  return c.json(user);
});

app.patch('/profile', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const { fullName, email } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  
  const updateData: any = { updatedAt: new Date().toISOString() };
  if (fullName) updateData.fullName = fullName;
  if (email) updateData.email = email;

  try {
    await db.update(schema.users).set(updateData).where(eq(schema.users.id, payload.id));
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, payload.id) });
    return c.json(user);
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
      return c.json({ error: 'El correo electrónico ya está en uso.' }, 409);
    }
    return c.json({ error: error.message }, 500);
  }
});

// Passenger Rides
app.get('/rides/my', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  const rides = await db.query.rides.findMany({
    where: eq(schema.rides.passengerId, payload.id),
    orderBy: [desc(schema.rides.createdAt)],
    limit: 20
  });
  return c.json(rides);
});

app.get('/rides/my-active', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  const activeRide = await db.query.rides.findFirst({
    where: and(
      eq(schema.rides.passengerId, payload.id),
      inArray(schema.rides.status, ['requested', 'accepted', 'in_progress'])
    )
  });
  return c.json(activeRide || null);
});

app.post('/rides/request', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const { pickup, dropoff, type, price, distance, duration, description, items } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  try {
    const newRide = await db.insert(schema.rides).values({
      passengerId: payload.id,
      pickupLatitude: pickup.lat,
      pickupLongitude: pickup.lng,
      pickupAddress: pickup.address,
      dropoffLatitude: dropoff.lat,
      dropoffLongitude: dropoff.lng,
      dropoffAddress: dropoff.address,
      rideType: type,
      baseFare: price,
      totalFare: price,
      distanceKm: distance,
      estimatedDurationMinutes: duration,
      errandDescription: description,
      errandItems: items,
      status: 'requested',
    }).returning();
    return c.json(newRide[0]);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/rides/:id/cancel', authGuard, async (c) => {
  const rideId = c.req.param('id');
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  await db.update(schema.rides).set({
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  }).where(and(eq(schema.rides.id, rideId), eq(schema.rides.passengerId, payload.id)));
  return c.json({ success: true });
});

// Driver Routes
app.get('/driver/setup', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  const driver = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, payload.id) });
  return c.json(driver || null);
});

app.post('/driver/setup', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const { vehicleType } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  try {
    const newDriver = await db.insert(schema.drivers)
      .values({
        id: payload.id, 
        vehicleType, 
        vehicleBrand: 'N/A', 
        vehicleModel: 'N/A', 
        vehicleYear: 2024,
        licensePlate: `TEMP-${Date.now()}`, 
        driverLicense: 'PENDING', 
        isActive: true, 
        isVerified: true,
        baseFare: 25, 
        costPerKm: 10, 
        costPerMinute: 2
      })
      .onConflictDoUpdate({
        target: schema.drivers.id,
        set: { 
          vehicleType,
          isActive: true,
          isVerified: true,
          updatedAt: new Date().toISOString()
        }
      })
      .returning();
    // Also ensure the user record is updated to 'driver' type
    await db.update(schema.users)
      .set({ userType: 'driver', updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, payload.id));

    return c.json(newDriver[0]);
  } catch (error: any) {
    console.error('[/driver/setup] Error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get('/driver/settings', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  const driver = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, payload.id) });
  if (!driver) return c.json({ error: 'Driver not found' }, 404);
  return c.json({
    baseFare: driver.baseFare,
    costPerKm: driver.costPerKm,
    costPerMinute: driver.costPerMinute,
    totalTrips: driver.totalTrips
  });
});

app.post('/driver/settings', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const { baseFare, costPerKm, costPerMinute } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });

  // Validation Limits
  if (baseFare < 20 || baseFare > 40) return c.json({ error: 'Tarifa base fuera de rango ($20 - $40)' }, 400);
  if (costPerKm < 6 || costPerKm > 12) return c.json({ error: 'Costo por km fuera de rango ($6 - $12)' }, 400);
  if (costPerMinute < 1.5 || costPerMinute > 3) return c.json({ error: 'Costo por minuto fuera de rango ($1.5 - $3)' }, 400);

  try {
    await db.update(schema.drivers).set({
      baseFare, costPerKm, costPerMinute, updatedAt: new Date().toISOString()
    }).where(eq(schema.drivers.id, payload.id));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/rides/available', authGuard, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const rides = await db.query.rides.findMany({
    where: eq(schema.rides.status, 'requested'),
    orderBy: [desc(schema.rides.createdAt)],
    limit: 10,
  });
  return c.json(rides);
});

app.get('/rides/active', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  const activeRide = await db.query.rides.findFirst({
    where: and(
      eq(schema.rides.driverId, payload.id),
      inArray(schema.rides.status, ['accepted', 'in_progress'])
    ),
  });
  return c.json(activeRide || null);
});

app.post('/rides/:id/accept', authGuard, async (c) => {
  const rideId = c.req.param('id');
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });

  // Fix: Prevent race condition – only accept if ride is still 'requested'
  const ride = await db.query.rides.findFirst({
    where: and(eq(schema.rides.id, rideId), eq(schema.rides.status, 'requested'))
  });
  if (!ride) return c.json({ error: 'El viaje ya no está disponible o fue aceptado por otro conductor' }, 409);

  await db.update(schema.rides).set({
    driverId: payload.id, status: 'accepted', acceptedAt: new Date().toISOString(),
  }).where(and(eq(schema.rides.id, rideId), eq(schema.rides.status, 'requested')));
  return c.json({ success: true });
});

app.post('/rides/:id/status', authGuard, async (c) => {
  const rideId = c.req.param('id');
  const { status } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  const update: any = { status };
  
  if (status === 'in_progress') update.startedAt = new Date().toISOString();
  
  if (status === 'completed') {
    update.completedAt = new Date().toISOString();
    
    // Calculate Commission Logic
    const ride = await db.query.rides.findFirst({ where: eq(schema.rides.id, rideId) });
    if (ride && ride.driverId) {
      const driver = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, ride.driverId) });
      if (driver) {
        const newTotalTrips = (driver.totalTrips || 0) + 1;
        let commissionAmount = 0;
        let commissionRate = 0;

        // Commission only after 5 trips
        if (newTotalTrips > 5) {
          commissionRate = 0.10; // 10%
          commissionAmount = (ride.totalFare || 0) * commissionRate;
        }

        update.commissionAmount = commissionAmount;
        update.commissionRate = commissionRate;

        // Update Driver Stats
        await db.update(schema.drivers).set({
          totalTrips: newTotalTrips,
          unpaidCommissionAmount: (driver.unpaidCommissionAmount || 0) + commissionAmount
        }).where(eq(schema.drivers.id, driver.id));
      }
    }
  }
  
  await db.update(schema.rides).set(update).where(eq(schema.rides.id, rideId));
  return c.json({ success: true });
});

// Real-time & Security Endpoints
app.post('/driver/location', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const { lat, lng } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  
  await db.update(schema.drivers)
    .set({ 
      currentLatitude: lat, 
      currentLongitude: lng, 
      lastLocationUpdate: new Date().toISOString(),
      isActive: true,
    })
    .where(eq(schema.drivers.id, payload.id));
    
  return c.json({ success: true });
});

app.get('/drivers/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const db = drizzle(c.env.DB, { schema });
  
  try {
    if (!c.env.DB) {
      console.error('[NearbyDrivers] DB binding missing');
      return c.json({ drivers: [] });
    }

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const activeDrivers = await db.query.drivers.findMany({
      where: eq(schema.drivers.isActive, true),
      limit: 10
    });

    // Filter in JS since D1 doesn't support datetime comparison easily
    const freshDrivers = activeDrivers.filter(d => 
      d.currentLatitude !== null && 
      d.currentLongitude !== null &&
      d.lastLocationUpdate !== null &&
      d.lastLocationUpdate > twoMinutesAgo
    );
    
    const drivers = freshDrivers.map(d => ({
      id: d.id,
      position: [d.currentLatitude!, d.currentLongitude!] as [number, number],
      type: d.vehicleType === 'motorcycle' ? 'moto' : 'taxi'
    }));

    return c.json({ drivers });
  } catch (error: any) {
    console.error('[NearbyDrivers] Critical Error:', error.message);
    return c.json({ drivers: [] });
  }
});


app.post('/verify-identity', authGuard, async (c) => {
  const { type } = await c.req.json();
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  
  // Fix: Persist verified = true in the users table for real
  await db.update(schema.users)
    .set({ verified: true, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, payload.id));
    
  if (type === 'driver') {
    await db.update(schema.drivers)
      .set({ isVerified: true, isActive: true })
      .where(eq(schema.drivers.id, payload.id));
  }

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, payload.id) });
  return c.json({ success: true, user });
});

// Mercado Pago Integration
app.post('/payments/create', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const { amount, paymentMethod, description } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  
  const mercadoPagoAccessToken = c.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';
  
  try {
    const preferenceData: any = {
      items: [{ title: description || 'Zipp Payment', quantity: 1, unit_price: amount }],
      back_urls: {
        success: `${c.req.header('origin')}/payment/success`,
        failure: `${c.req.header('origin')}/payment/failure`,
        pending: `${c.req.header('origin')}/payment/pending`,
      },
      auto_return: 'approved',
      notification_url: `${new URL(c.req.url).origin}/api/payments/webhook`,
      metadata: { driver_id: payload.id },
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mercadoPagoAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preferenceData),
    });

    const preference = await mpRes.json() as any;
    
    // Save to DB
    await db.insert(schema.commissionPayments).values({
      driverId: payload.id,
      amount,
      paymentMethod: paymentMethod as any,
      mercadopagoPreferenceId: preference.id,
      paymentUrl: preference.init_point,
      status: 'pending',
    });

    return c.json({ preference_id: preference.id, init_point: preference.init_point });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/payments/webhook', async (c) => {
  const body = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  
  if (body.type === 'payment' && body.data?.id) {
    const paymentId = body.data.id;
    const mercadoPagoAccessToken = c.env.MERCADOPAGO_ACCESS_TOKEN;
    
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mercadoPagoAccessToken}` }
    });
    
    const payment = await mpRes.json() as any;
    if (payment.status === 'approved') {
      const preferenceId = payment.order?.id || payment.preference_id;
      if (preferenceId) {
        await db.update(schema.commissionPayments).set({
          status: 'approved',
          mercadopagoPaymentId: paymentId.toString(),
          paidAt: new Date().toISOString(),
        }).where(eq(schema.commissionPayments.mercadopagoPreferenceId, preferenceId));
      }
    }
  }
  
  return c.text('OK');
});

export const onRequest = handle(app);
