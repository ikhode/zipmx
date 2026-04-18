import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, inArray, gte } from 'drizzle-orm';
import { jwt, sign } from 'hono/jwt';
import * as schema from '../../src/db/schema';

import { Context, Next } from 'hono';
import type { D1Database, DurableObjectNamespace, R2Bucket } from '@cloudflare/workers-types';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  MERCADOPAGO_ACCESS_TOKEN: string;
  LOCATION_TRACKER: DurableObjectNamespace;
  STORAGE: R2Bucket;
  VAPID_PRIVATE_KEY?: string;
};

type JWTPayload = {
  id: string;
  email: string;
  exp: number;
};

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

const getSecret = (c: Context<{ Bindings: Bindings }>): string => {
  const secret = c.env?.JWT_SECRET;
  if (secret) return secret;
  // Fallback for local dev
  return 'super-secret-dev-jwt-key!_update_in_prod';
};

import webpush from 'web-push';

const VAPID_PUBLIC_KEY = 'BAUYCP62A2X6DrcfXh_zYOWNMEG2LlevQ7DTWeh9LbyweeguGn2aRyJkktrc246AprcH7Il-hifvHDM9RGQ578E';

/**
 * Función genérica de Push que usa Web Push Nativo
 */
async function sendPush(pushSubscriptionObjBase64OrJson: string, title: string, body: string, c: Context<{ Bindings: Bindings }>, data: Record<string, string> = {}) {
  const privateKey = c.env?.VAPID_PRIVATE_KEY || 'xPfOhpRZadnvZD_UH5hwTtbFBJBVnhrVSW9NLevhTWk'; // Fallback dev key
  
  if (!pushSubscriptionObjBase64OrJson) return;

  try {
    const subObj = JSON.parse(pushSubscriptionObjBase64OrJson);
    
    webpush.setVapidDetails(
      'mailto:contacto@monpra.com',
      VAPID_PUBLIC_KEY,
      privateKey
    );

    const payload = JSON.stringify({
      title,
      body,
      data: {
        ...data,
        click_action: "FLUTTER_NOTIFICATION_CLICK" 
      }
    });

    await webpush.sendNotification(subObj, payload);
  } catch (err) {
    console.error('[WebPush] Error de red o encriptación al enviar push:', err);
  }
}

/**
 * Notifica al Durable Object que un viaje ya no está disponible
 */
async function notifyRideUnavailable(env: Bindings, rideId: string) {
  try {
    const id = env.LOCATION_TRACKER.idFromName('global');
    const obj = env.LOCATION_TRACKER.get(id);
    await obj.fetch('http://do/api/ws', {
      method: 'POST',
      body: JSON.stringify({ type: 'ride_unavailable', id: rideId })
    });
  } catch (e) {
    console.error('[LocationTracker] Error enviando ride_unavailable:', e);
  }
}

async function notifyChatMessage(env: Bindings, rideId: string, message: any) {
  try {
    const id = env.LOCATION_TRACKER.idFromName('global');
    const obj = env.LOCATION_TRACKER.get(id);
    await obj.fetch('http://do/api/ws', {
      method: 'POST',
      body: JSON.stringify({ type: 'chat_message', rideId, message })
    });
  } catch (e) {
    console.error('[LocationTracker] Error enviando chat_message:', e);
  }
}

/**
 * Notifica a los conductores activos sobre un nuevo viaje propuesto
 */
async function notifyAvailableDrivers(c: Context<{ Bindings: Bindings }>, ride: any) {
  const db = drizzle(c.env.DB, { schema });
  try {
    // 1. WebSocket Broadcast via Durable Object
    const id = c.env.LOCATION_TRACKER.idFromName('global');
    const obj = c.env.LOCATION_TRACKER.get(id);
    await obj.fetch('http://do/api/ws', {
      method: 'POST',
      body: JSON.stringify({ type: 'new_ride', ride })
    });

    // 2. Web Push Notifications
    // Obtenemos conductores activos (limitado a 20 para evitar sobrecarga en push)
    const activeDrivers = await db.query.drivers.findMany({
      where: eq(schema.drivers.isActive, true),
      limit: 20
    });

    if (activeDrivers.length > 0) {
      const driverIds = activeDrivers.map(d => d.id);
      const driverProfiles = await db.query.users.findMany({
        where: inArray(schema.users.id, driverIds)
      });

      const pushPromises = driverProfiles
        .filter(p => p.pushSubscription)
        .map(p => sendPush(
          p.pushSubscription!, 
          ride.rideType === 'ride' ? '🚕 ¡Nuevo Viaje Disponible!' : '📦 ¡Nuevo Mandadito!', 
          `Un pasajero solicita transporte en ${ride.pickupAddress.split(',')[0]}. ¡Acepta ahora!`, 
          c,
          { rideId: ride.id, type: 'NEW_RIDE' }
        ));
      
      await Promise.allSettled(pushPromises);
    }
  } catch (e) {
    console.error('[NotificationService] Error al notificar conductores:', e);
  }
}

const authGuard = (c: Context<{ Bindings: Bindings }>, next: Next) => jwt({ secret: getSecret(c), alg: 'HS256' })(c, next);

app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// WebSocket Entry point
app.all('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426) as any;
  }

  // Get a single global instance for simplicity in this project
  const id = c.env.LOCATION_TRACKER.idFromName('global');
  const obj = c.env.LOCATION_TRACKER.get(id);

  return obj.fetch(c.req.raw as any) as any;
});

interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
  address: Record<string, string>;
}

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
  url += `&viewbox=${bLon - d},${bLat + d},${bLon + d},${bLat - d}&bounded=0`; // bounded=0 allows finding nearby if not in viewbox

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ZippMobilityApp/1.0 (https://zipp.inteligent.software)' }
    });

    if (response.status === 429) return c.json({ error: 'Rate limit exceeded' }, 429);

    const data = await response.json() as GeocodingResult[];
    if (data.length === 0) return c.json(null);

    return c.json({
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      display_name: data[0].display_name,
      address: data[0].address || {},
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
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
  url += `&viewbox=${bLon - d},${bLat + d},${bLon + d},${bLat - d}&bounded=0`;

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

    const data = await response.json() as GeocodingResult;
    return c.json({
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      display_name: data.display_name,
      address: data.address || {},
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// Storage Endpoints (R2)
app.post('/upload', authGuard, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const body = await c.req.parseBody();
    const file = body['file'] as unknown as File; // File object

    if (!file || !file.name) return c.json({ error: 'Archivo no válido' }, 400);

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const key = `uploads/${payload.id}/${fileName}`;

    await c.env.STORAGE.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' }
    });

    const url = `/api/files/${key}`;
    return c.json({ url, key });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: `Error al subir: ${message}` }, 500);
  }
});

app.get('/files/:path{.+}', async (c) => {
  const path = c.req.param('path');
  try {
    const object = await c.env.STORAGE.get(path);
    if (!object) return c.notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers as any);
    headers.set('etag', object.httpEtag);

    // Cache for 1 day
    headers.set('Cache-Control', 'public, max-age=86400');

    return c.body(object.body as any, 200, Object.fromEntries(headers.entries()));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

interface OSRMResponse {
  code: string;
  routes: Array<{
    geometry: any;
    duration: number;
    distance: number;
  }>;
}

// Routing Proxy (OSRM) to avoid CORS and aggregate multiple reliable providers
app.get('/routing/route', async (c) => {
  const coords = c.req.query('coords'); // format: "lon1,lat1;lon2,lat2"
  if (!coords) return c.json({ error: 'Coordinates are required' }, 400);

  // Split coords to check if they are the same
  const points = coords.split(';');
  if (points.length >= 2 && points[0] === points[1]) {
    // If start and end are identical, return a trivial route to avoid server overhead
    const [lon, lat] = points[0].split(',').map(Number);
    return c.json({
      code: 'Ok',
      routes: [{
        geometry: { type: 'LineString', coordinates: [[lon, lat], [lon, lat]] },
        duration: 0,
        distance: 0
      }]
    });
  }

  // Use multiple reliable OSRM instances.
  const osrmInstances = [
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${coords}?overview=full&geometries=geojson` // Last resort
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5500); // 5.5s timeout to stay within CF limits

  try {
    const fetchPromises = osrmInstances.map(url =>
      fetch(url, { 
        headers: { 
          'User-Agent': 'ZippMobilityApp/1.1 (Contact: support@zipmx.app)',
          'Accept': 'application/json'
        }, 
        signal: controller.signal 
      })
      .then(async res => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json() as OSRMResponse;
        if (!data || data.code?.toLowerCase() !== 'ok' || !data.routes?.[0]) throw new Error(`OSRM Invalid: ${data.code}`);
        return data;
      })
    );

    // Promise.any resolves as soon as THE FIRST one succeeds
    const result = await Promise.any(fetchPromises);
    return c.json(result);
  } catch (error: unknown) {
    console.error('Routing Proxy Error:', error);
    
    // EMERGENCY FALLBACK: If all servers fail, return a straight line geometry 
    // instead of an error, so the map still renders a route.
    const path = points.map(p => p.split(',').map(Number));
    return c.json({
      code: 'Ok',
      isFallback: true,
      routes: [{
        geometry: { type: 'LineString', coordinates: path },
        duration: 0,
        distance: 0
      }]
    }, 200); // Still return 200 to keep the UI stable
  } finally {
    clearTimeout(timeoutId);
  }
});


app.post('/auth/signup', async (c) => {
  try {
    const { email, phone, fullName, userType, id: firebaseId } = await c.req.json();
    const db = drizzle(c.env.DB, { schema });
    const secret = getSecret(c);

    // Validation
    if (!email || !phone || !fullName || !userType) {
      return c.json({ error: 'Todos los campos son obligatorios.' }, 400);
    }

    // Normalize phone for consistency
    const normalizedPhone = phone.startsWith('+') ? phone : `+52${phone.replace(/\D/g, '')}`;

    // 1. Check if user already exists (e.g. created by verify-otp)
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.phone, normalizedPhone)
    });

    let user;
    if (existingUser) {
      // 2. Update existing placeholder/user
      const updated = await db.update(schema.users)
        .set({
          email,
          fullName,
          userType,
          phone: normalizedPhone,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.users.id, existingUser.id))
        .returning();
      user = updated[0];
    } else {
      // 3. Fresh insert
      const newUser = await db.insert(schema.users).values({
        id: firebaseId || undefined,
        email,
        phone: normalizedPhone,
        fullName,
        userType,
      }).returning();
      user = newUser[0];
    }

    if (!user) {
      throw new Error('No se pudo procesar el usuario en la base de datos.');
    }

    const payload: JWTPayload = { id: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 };
    const token = await sign(payload, secret, 'HS256');
    return c.json({ user, token });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    const cause = (error as any)?.cause;
    const causeMsg = cause?.message || '';

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
    const base64Url = (idToken as string).split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    interface FirebasePayload {
      iss: string;
      aud: string;
      sub: string;
      exp: number;
      name?: string;
      phone_number?: string;
      email?: string;
      provider_id?: string;
    }
    const payload = JSON.parse(jsonPayload) as FirebasePayload;

    if (payload.iss !== `https://securetoken.google.com/zipp-mx` || payload.aud !== `zipp-mx`) {
      return c.json({ error: 'Token de Firebase inválido' }, 401);
    }

    if (payload.exp < Date.now() / 1000) {
      return c.json({ error: 'Token expirado' }, 401);
    }

    const firebaseUid = payload.sub;

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
      
      // Fallback: try without prefix if it's a 10 digit number in the DB
      if (!user && firebasePhone.startsWith('+52')) {
        const phoneWithoutPrefix = firebasePhone.slice(3);
        user = await db.query.users.findFirst({ where: eq(schema.users.phone, phoneWithoutPrefix) });
      }
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

        user = (await db.query.users.findFirst({ where: eq(schema.users.id, user.id) }))!;
      }
    }

    // Marcar códigos OTP previos como usados para este teléfono
    if (user!.phone) {
      await db.update(schema.verificationCodes)
        .set({ used: true })
        .where(eq(schema.verificationCodes.phone, user!.phone));
    }

    // Generate JWT Token for Zipp Session
    const secret = getSecret(c);
    const payloadJWT: JWTPayload = { 
      id: user!.id, 
      email: user!.email, 
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
    };
    const token = await sign(payloadJWT, secret, 'HS256');

    return c.json({
      success: true,
      user,
      token,
      isNewUser: user!.phone.startsWith('anon_') || user!.fullName === 'Usuario Zipp'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/auth/verify-otp] Backend Error:', {
      message,
      stack: err instanceof Error ? err.stack : undefined
    });
    return c.json({ 
      error: 'Error de sincronización de identidad', 
      details: message 
    }, 500);
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
  const { fullName, email, pushSubscription } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });

  const updateData: Partial<typeof schema.users.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (fullName) updateData.fullName = fullName;
  if (email) updateData.email = email;
  if (pushSubscription) updateData.pushSubscription = pushSubscription;

  try {
    await db.update(schema.users).set(updateData).where(eq(schema.users.id, payload.id));
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, payload.id) });
    return c.json(user);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('UNIQUE')) {
      return c.json({ error: 'El correo electrónico ya está en uso.' }, 409);
    }
    return c.json({ error: message }, 500);
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
      inArray(schema.rides.status, ['requested', 'accepted', 'arrived', 'in_progress'])
    ),
    orderBy: [desc(schema.rides.createdAt)]
  });

  // Lógica de expiración automática: Si el viaje sigue en 'requested' por más de 10 min
  if (activeRide && activeRide.status === 'requested') {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    if (activeRide.createdAt && activeRide.createdAt < tenMinutesAgo) {
      const [cancelledRide] = await db.update(schema.rides)
        .set({ status: 'cancelled', cancelledAt: new Date().toISOString() })
        .where(eq(schema.rides.id, activeRide.id))
        .returning();
      
      // Notificar al tracker para que los conductores limpien si aún lo tenían en lista (aunque el filtro ya lo debería haber quitado)
      await notifyRideUnavailable(c.env, activeRide.id);
      
      return c.json(cancelledRide);
    }
  }

  return c.json(activeRide || null);
});

// Get a single ride with embedded public driver info (for passenger tracking screen)
app.get('/rides/:id/details', authGuard, async (c) => {
  const rideId = c.req.param('id');
  if (!rideId) return c.json({ error: 'ID de viaje requerido' }, 400);

  const db = drizzle(c.env.DB, { schema });

  const ride = await db.query.rides.findFirst({ where: eq(schema.rides.id, rideId) });
  if (!ride) return c.json({ error: 'Viaje no encontrado' }, 404);

  const payload = c.get('jwtPayload') as JWTPayload;
  // Seguridad: Solo el pasajero o el conductor del viaje pueden ver los detalles
  if (ride.passengerId !== payload.id && ride.driverId !== payload.id) {
    return c.json({ error: 'No tienes permiso para ver los detalles de este viaje' }, 403);
  }

  let driverInfo = null;
  if (ride.driverId) {
    const [driver, driverUser, driverRating] = await Promise.all([
      db.query.drivers.findFirst({ where: eq(schema.drivers.id, ride.driverId) }),
      db.query.users.findFirst({ where: eq(schema.users.id, ride.driverId) }),
      db.query.ratingSummary.findFirst({ where: eq(schema.ratingSummary.userId, ride.driverId) }),
    ]);

    if (driver && driverUser) {
      driverInfo = {
        fullName: driverUser.fullName,
        vehicleBrand: driver.vehicleBrand,
        vehicleModel: driver.vehicleModel,
        vehicleYear: driver.vehicleYear,
        vehicleType: driver.vehicleType,
        licensePlate: driver.licensePlate,
        rating: driverRating?.averageRating ?? driver.rating ?? 5.0,
        totalTrips: driver.totalTrips ?? 0,
      };
    }
  }

  return c.json({ ...ride, driverInfo });
});

app.post('/rides/request', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  try {
    const { pickup, dropoff, type, price, distance, duration, description, items } = await c.req.json();
    const db = drizzle(c.env.DB, { schema });

    // Anti-Fraude: Validar el precio en el servidor usando tarifas oficiales
    const VEHICLE_RATES: Record<string, { base: number, km: number, min: number }> = { 
      'car': { base: 25, km: 10.0, min: 2.0 }, 
      'taxi': { base: 30, km: 11.0, min: 2.2 }, 
      'rickshaw': { base: 20, km: 8.0, min: 1.5 }, 
      'motorcycle': { base: 22, km: 9.0, min: 1.8 }
    };

    const rates = VEHICLE_RATES[type] || VEHICLE_RATES['car'];
    const calculatedMinPrice = rates.base + (distance * rates.km) + (duration * rates.min);
    
    // Permitir un margen del 15% por variaciones de redondeo o promociones futuras
    if (price < calculatedMinPrice * 0.85) {
      console.warn(`[AntiFraud] Bloqueado viaje de $${price}. Geolocalización sugería min: $${calculatedMinPrice}`);
      return c.json({ 
        error: 'Precio inválido o manipulado', 
        details: 'El precio propuesto es demasiado bajo para la distancia solicitada.' 
      }, 400);
    }
    
    // Clear any previous stuck rides for this passenger
    await db.update(schema.rides)
      .set({ status: 'cancelled', cancelledAt: new Date().toISOString() })
      .where(and(
        eq(schema.rides.passengerId, payload.id),
        inArray(schema.rides.status, ['requested', 'accepted', 'arrived', 'in_progress'])
      ));

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
    
    // Notificar a los conductores de inmediato
    await notifyAvailableDrivers(c, newRide[0]);

    return c.json(newRide[0]);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/rides/:id/cancel', authGuard, async (c) => {
  const rideId = c.req.param('id') as string;
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });

  // Solo permitir cancelar si el viaje no ha comenzado (requested, accepted)
  const updated = await db.update(schema.rides).set({
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  }).where(and(
    eq(schema.rides.id, rideId), 
    eq(schema.rides.passengerId, payload.id),
    inArray(schema.rides.status, ['requested', 'accepted'])
  )).returning();

  if (updated.length === 0) {
    return c.json({ error: 'No puedes cancelar un viaje que ya está en camino o ha finalizado' }, 400);
  }
  
  // Notificar al tracker para limpiar el overlay de los conductores (si aplica)
  await notifyRideUnavailable(c.env, rideId);
  
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
  const {
    vehicleType,
    vehicleBrand,
    vehicleModel,
    vehicleYear,
    licensePlate,
  } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });

  // Validate required vehicle fields
  if (!vehicleType) return c.json({ error: 'Tipo de vehículo requerido' }, 400);
  if (!vehicleBrand || !vehicleModel) return c.json({ error: 'Marca y modelo del vehículo son requeridos' }, 400);
  if (!vehicleYear || vehicleYear < 1990 || vehicleYear > new Date().getFullYear() + 1) {
    return c.json({ error: 'Año del vehículo inválido' }, 400);
  }
  if (!licensePlate || licensePlate.trim().length < 3) {
    return c.json({ error: 'Número de placas requerido' }, 400);
  }

  try {
    const newDriver = await db.insert(schema.drivers)
      .values({
        id: payload.id,
        vehicleType,
        vehicleBrand: vehicleBrand.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleYear: parseInt(vehicleYear, 10),
        licensePlate: licensePlate.trim().toUpperCase(),
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
          vehicleBrand: vehicleBrand.trim(),
          vehicleModel: vehicleModel.trim(),
          vehicleYear: parseInt(vehicleYear, 10),
          licensePlate: licensePlate.trim().toUpperCase(),
          isActive: true,
          isVerified: true,
          updatedAt: new Date().toISOString()
        }
      })
      .returning();

    // Ensure the user record is updated to 'driver' type
    await db.update(schema.users)
      .set({ userType: 'driver', updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, payload.id));

    return c.json(newDriver[0]);
  } catch (error: any) {
    console.error('[/driver/setup] Error:', error);
    // Handle duplicate license plate
    const errStr = `${error.message} ${error.cause?.message || ''}`.toLowerCase();
    if (errStr.includes('unique') && errStr.includes('license_plate')) {
      return c.json({ error: 'Esas placas ya están registradas por otro conductor.' }, 409);
    }
    return c.json({ error: error.message }, 500);
  }
});

app.get('/driver/settings', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  const driver = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, payload.id) });
  if (!driver) return c.json({ error: 'Driver not found' }, 404);

  // Approximation to convert UTC to Mexico Central Time (UTC-6)
  const todayStart = new Date();
  todayStart.setUTCHours(todayStart.getUTCHours() - 6);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  const todayRides = await db.query.rides.findMany({
    where: and(
      eq(schema.rides.driverId, payload.id),
      eq(schema.rides.status, 'completed'),
      gte(schema.rides.completedAt, todayStr)
    )
  });

  const todayTripsCount = todayRides.length;
  const todayEarningsAmount = todayRides.reduce((sum, r) => sum + (r.totalFare || 0), 0);

  return c.json({
    baseFare: driver.baseFare,
    costPerKm: driver.costPerKm,
    costPerMinute: driver.costPerMinute,
    totalTrips: driver.totalTrips,
    totalEarnings: driver.totalEarnings,
    unpaidCommissionAmount: driver.unpaidCommissionAmount,
    todayTrips: todayTripsCount,
    todayEarnings: todayEarningsAmount
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
  
  // 10 minutos de expiración para viajes requested
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const rides = await db.query.rides.findMany({
    where: and(
      eq(schema.rides.status, 'requested'),
      gte(schema.rides.createdAt, tenMinutesAgo)
    ),
    orderBy: [desc(schema.rides.createdAt)],
    limit: 10,
  });

  // Enrich each ride with the passenger rating (for driver decision-making)
  const enriched = await Promise.all(
    rides.map(async (ride) => {
      const passengerRating = await db.query.ratingSummary.findFirst({
        where: eq(schema.ratingSummary.userId, ride.passengerId),
      });
      return {
        ...ride,
        passengerRating: passengerRating?.averageRating ?? null,
        passengerTotalRatings: passengerRating?.totalRatings ?? 0,
      };
    })
  );

  return c.json(enriched);
});

app.get('/rides/active', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });
  const activeRide = await db.query.rides.findFirst({
    where: and(
      eq(schema.rides.driverId, payload.id),
      inArray(schema.rides.status, ['accepted', 'arrived', 'in_progress'])
    ),
  });
  return c.json(activeRide || null);
});

app.post('/rides/:id/accept', authGuard, async (c) => {
  const rideId = c.req.param('id') as string;
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });

  // 1. Verificar bloqueo administrativo
  const driver = await db.query.drivers.findFirst({ where: eq(schema.drivers.id, payload.id) });
  if (driver && driver.isBlocked) {
    return c.json({ error: 'Tu cuenta de conductor está bloqueada por administración' }, 403);
  }

  // 2. Verificar morosidad del conductor
  if (driver && (driver.unpaidCommissionAmount || 0) > 500) {
    return c.json({ 
      error: 'Deuda de comisiones excedida ($' + driver.unpaidCommissionAmount.toFixed(2) + ')', 
      details: 'Debes liquidar tus comisiones pendientes para seguir operando.' 
    }, 403);
  }

  // 2. Verificar si el conductor ya tiene un viaje activo (Exclusividad)
  const activeRideCheck = await db.query.rides.findFirst({
    where: and(
      eq(schema.rides.driverId, payload.id),
      inArray(schema.rides.status, ['accepted', 'arrived', 'in_progress'])
    )
  });
  if (activeRideCheck) {
    return c.json({ error: 'Ya tienes un viaje activo en curso' }, 400);
  }

  // 3. Fix: Prevent race condition – only accept if ride is still 'requested'
  // We use returning() to check if the update actually matched the requested status
  const updated = await db.update(schema.rides).set({
    driverId: payload.id, status: 'accepted', acceptedAt: new Date().toISOString(),
  }).where(and(eq(schema.rides.id, rideId), eq(schema.rides.status, 'requested'))).returning();

  if (updated.length === 0) {
    return c.json({ error: 'El viaje ya no está disponible o fue aceptado por otro conductor' }, 409);
  }

  const ride = updated[0];

  // 4. Notificar al tracker que el viaje ya no está disponible (limpiar overlays)
  await notifyRideUnavailable(c.env, rideId);

  // Trigger push to passenger
  try {
    const passenger = await db.query.users.findFirst({ where: eq(schema.users.id, ride.passengerId) });
    if (passenger?.pushSubscription) {
       await sendPush(passenger.pushSubscription, '¡Tu viaje fue aceptado!', 'El conductor va en camino hacia tu punto de recogida.', c);
    }
  } catch (e) { console.error(e); }

  return c.json({ success: true });
});

app.post('/rides/:id/status', authGuard, async (c) => {
  const rideId = c.req.param('id') as string;
  const { status } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });
  const update: Partial<typeof schema.rides.$inferInsert> = { status };

  if (status === 'in_progress') update.startedAt = new Date().toISOString();

  if (status === 'arrived') {
    // Trigger push to passenger
    try {
      const ride = await db.query.rides.findFirst({ where: eq(schema.rides.id, rideId) });
      if (ride && ride.passengerId) {
         const passenger = await db.query.users.findFirst({ where: eq(schema.users.id, ride.passengerId) });
         if (passenger?.pushSubscription) {
            await sendPush(passenger.pushSubscription, '¡Tu conductor ha llegado!', 'Sal al punto de encuentro, el conductor te está esperando.', c);
         }
      }
    } catch (e) { console.error(e); }
  }

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

        // Commission only after 5 trips (Incentive for new drivers)
        if (newTotalTrips > 5) {
          commissionRate = 0.10; // 10%
          commissionAmount = (ride.totalFare || 0) * commissionRate;
        }

        update.commissionAmount = commissionAmount;
        update.commissionRate = commissionRate;

        // Perform both updates atomically using batch
        await db.batch([
          db.update(schema.drivers).set({
            totalTrips: newTotalTrips,
            totalEarnings: (driver.totalEarnings || 0) + (ride.totalFare || 0),
            unpaidCommissionAmount: (driver.unpaidCommissionAmount || 0) + commissionAmount,
            updatedAt: new Date().toISOString()
          }).where(eq(schema.drivers.id, driver.id)),
          db.update(schema.rides).set(update).where(eq(schema.rides.id, rideId))
        ]);
        
        return c.json({ success: true });
      }
    }
  }

  // Fallback or other status updates
  await db.update(schema.rides).set(update).where(eq(schema.rides.id, rideId));
  return c.json({ success: true });
});

// Ratings
app.post('/rides/:id/rate', authGuard, async (c) => {
  const rideId = c.req.param('id') as string;
  const payload = c.get('jwtPayload') as JWTPayload;
  const { ratedId, rating, comment } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });

  if (!rating || rating < 1 || rating > 5) {
    return c.json({ error: 'Calificación inválida (debe ser de 1 a 5)' }, 400);
  }

  if (payload.id === ratedId) {
    return c.json({ error: 'No puedes calificarte a ti mismo' }, 400);
  }

  try {
    // 1. Validate ride exists and is completed
    const ride = await db.query.rides.findFirst({
      where: eq(schema.rides.id, rideId)
    });

    if (!ride) return c.json({ error: 'Viaje no encontrado' }, 404);
    if (ride.status !== 'completed') {
      return c.json({ error: 'Solo puedes calificar viajes completados' }, 400);
    }

    // 2. Validate rater and rated were part of the ride
    const isRaterPassenger = ride.passengerId === payload.id;
    const isRaterDriver = ride.driverId === payload.id;
    const isRatedPassenger = ride.passengerId === ratedId;
    const isRatedDriver = ride.driverId === ratedId;

    if (!isRaterPassenger && !isRaterDriver) {
      return c.json({ error: 'No participaste en este viaje' }, 403);
    }

    if (!isRatedPassenger && !isRatedDriver) {
      return c.json({ error: 'El usuario calificado no participó en este viaje' }, 400);
    }

    // 3. Insert rating (Unique constraint will handle double-rating if added to DB)
    await db.insert(schema.ratings).values({
      rideId,
      raterId: payload.id,
      ratedId,
      rating: Math.floor(rating),
      comment
    });

    // 4. Update rating_summary incrementally
    const summary = await db.query.ratingSummary.findFirst({
      where: eq(schema.ratingSummary.userId, ratedId)
    });

    if (summary) {
      const newTotal = (summary.totalRatings || 0) + 1;
      const newAverage = ((summary.averageRating || 0) * (summary.totalRatings || 0) + rating) / newTotal;

      await db.update(schema.ratingSummary)
        .set({
          averageRating: newAverage,
          totalRatings: newTotal,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.ratingSummary.userId, ratedId));
    } else {
      await db.insert(schema.ratingSummary).values({
        userId: ratedId,
        averageRating: rating,
        totalRatings: 1
      });
    }

    // 5. Also update the legacy 'rating' field in drivers table if the rated user is a driver
    if (isRatedDriver) {
      const updatedSummary = await db.query.ratingSummary.findFirst({
        where: eq(schema.ratingSummary.userId, ratedId)
      });
      if (updatedSummary) {
        await db.update(schema.drivers)
          .set({ rating: updatedSummary.averageRating })
          .where(eq(schema.drivers.id, ratedId));
      }
    }

    return c.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE') || error.cause?.message?.includes('UNIQUE')) {
       return c.json({ error: 'Ya has calificado este viaje para este usuario' }, 409);
    }
    return c.json({ error: error.message }, 500);
  }
});

app.get('/ratings/user/:id', authGuard, async (c) => {
  const userId = c.req.param('id');
  if (!userId) return c.json({ error: 'ID de usuario requerido' }, 400);

  const db = drizzle(c.env.DB, { schema });

  const userRatings = await db.query.ratings.findMany({
    where: eq(schema.ratings.ratedId, userId),
    orderBy: [desc(schema.ratings.createdAt)],
    limit: 50
  });

  return c.json(userRatings);
});

app.get('/ratings/summary/:id', async (c) => {
  const userId = c.req.param('id');
  if (!userId) return c.json({ error: 'ID de usuario requerido' }, 400);

  const db = drizzle(c.env.DB, { schema });

  const summary = await db.query.ratingSummary.findFirst({
    where: eq(schema.ratingSummary.userId, userId)
  });

  if (!summary) {
    return c.json({ userId, averageRating: 5.0, totalRatings: 0 });
  }

  return c.json(summary);
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

app.post('/driver/status', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const { isActive } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });

  // Seguridad: No permitir irse offline si hay un viaje activo
  if (isActive === false) {
    const activeRideCheck = await db.query.rides.findFirst({
      where: and(
        eq(schema.rides.driverId, payload.id),
        inArray(schema.rides.status, ['accepted', 'arrived', 'in_progress'])
      )
    });
    if (activeRideCheck) {
      return c.json({ error: 'No puedes ponerte fuera de línea mientras tienes un viaje activo' }, 400);
    }
  }

  await db.update(schema.drivers)
    .set({
      isActive,
      updatedAt: new Date().toISOString()
    })
    .where(eq(schema.drivers.id, payload.id));

  return c.json({ success: true, isActive });
});

app.get('/drivers/nearby', async (c) => {
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NearbyDrivers] Critical Error:', message);
    return c.json({ drivers: [] });
  }
});


app.post('/verify-identity', authGuard, async (c) => {
  const { type, name, phone } = await c.req.json();
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });

  // 1. Si se intenta actualizar el teléfono, verificar que no esté en uso por otro ID
  if (phone) {
    const existing = await db.query.users.findFirst({
      where: and(eq(schema.users.phone, phone), ne(schema.users.id, payload.id))
    });
    if (existing) {
      return c.json({ error: 'Este número de teléfono ya está vinculado a otra cuenta' }, 409);
    }
  }

  // 2. Persistir verificado y datos básicos
  await db.update(schema.users)
    .set({ 
      verified: true, 
      fullName: name || undefined, 
      phone: phone || undefined,
      updatedAt: new Date().toISOString() 
    })
    .where(eq(schema.users.id, payload.id));

  if (type === 'driver') {
    await db.update(schema.drivers)
      .set({ isVerified: true, isActive: true })
      .where(eq(schema.drivers.id, payload.id));
  }

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, payload.id) });
  return c.json({ success: true, user });
});

// Cancelación lado conductor (No-show o emergencia)
app.post('/rides/:id/driver-cancel', authGuard, async (c) => {
  const rideId = c.req.param('id');
  const payload = c.get('jwtPayload') as JWTPayload;
  const db = drizzle(c.env.DB, { schema });

  const ride = await db.query.rides.findFirst({ where: eq(schema.rides.id, rideId!) });
  if (!ride || ride.driverId !== payload.id) {
    return c.json({ error: 'No autorizado o viaje no encontrado' }, 403);
  }

  if (ride.status === 'in_progress') {
    return c.json({ error: 'No puedes cancelar un viaje que ya ha iniciado' }, 400);
  }

  await db.update(schema.rides)
    .set({ 
      status: 'cancelled', 
      cancelledAt: new Date().toISOString(),
      notes: (ride.notes || '') + ' [Cancelado por conductor]'
    })
    .where(eq(schema.rides.id, rideId!));

  await notifyRideUnavailable(c.env, rideId!);
  return c.json({ success: true });
});

// Chat Endpoints
app.get('/rides/:id/messages', authGuard, async (c) => {
  const rideId = c.req.param('id');
  const db = drizzle(c.env.DB, { schema });
  const messages = await db.query.rideMessages.findMany({
    where: eq(schema.rideMessages.rideId, rideId!),
    orderBy: [asc(schema.rideMessages.createdAt)]
  });
  return c.json(messages);
});

app.post('/rides/:id/messages', authGuard, async (c) => {
  const rideId = c.req.param('id');
  const payload = c.get('jwtPayload') as JWTPayload;
  const { text } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });

  const [newMessage] = await db.insert(schema.rideMessages).values({
    rideId: rideId!,
    senderId: payload.id,
    text: text.trim(),
  }).returning();

  await notifyChatMessage(c.env, rideId!, newMessage);
  return c.json(newMessage);
});

// Mercado Pago Integration
app.post('/payments/create', authGuard, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const { amount, paymentMethod, description } = await c.req.json();
  const db = drizzle(c.env.DB, { schema });

  const mercadoPagoAccessToken = c.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';

  try {
    interface MercadoPagoPreference {
      items: Array<{ title: string; quantity: number; unit_price: number }>;
      back_urls: { success: string; failure: string; pending: string };
      auto_return: string;
      notification_url: string;
      metadata: Record<string, any>;
    }

    const preferenceData: MercadoPagoPreference = {
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

    interface MPResponse {
      id: string;
      init_point: string;
    }
    const preference = await mpRes.json() as MPResponse;

    // Save to DB
    await db.insert(schema.commissionPayments).values({
      driverId: payload.id,
      amount,
      paymentMethod: paymentMethod as any, // Enum conversion might need narrowing if strict
      mercadopagoPreferenceId: preference.id,
      paymentUrl: preference.init_point,
      status: 'pending',
    });

    return c.json({ preference_id: preference.id, init_point: preference.init_point });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
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

    if (!mpRes.ok) return c.text('Provider Error', 500);

    const payment = await mpRes.json() as any;
    if (payment.status === 'approved') {
      const preferenceId = payment.order?.id || payment.preference_id;
      if (preferenceId) {
        // 1. Bucar el registro del pago pendiente
        const commPayment = await db.query.commissionPayments.findFirst({
          where: and(
            eq(schema.commissionPayments.mercadopagoPreferenceId, preferenceId),
            eq(schema.commissionPayments.status, 'pending') // Solo procesar si sigue pendiente
          )
        });

        if (commPayment) {
          // 2. Actualizar el pago a aprobado y restar la deuda del conductor atómicamente
          await db.batch([
            db.update(schema.commissionPayments).set({
              status: 'approved',
              mercadopagoPaymentId: paymentId.toString(),
              paidAt: new Date().toISOString(),
            }).where(eq(schema.commissionPayments.id, commPayment.id)),

            // Actualizar la deuda en la tabla drivers de forma atómica
            db.update(schema.drivers)
              .set({
                unpaidCommissionAmount: sql`${schema.drivers.unpaidCommissionAmount} - ${commPayment.amount}`,
                updatedAt: new Date().toISOString()
              })
              .where(eq(schema.drivers.id, commPayment.driverId))
          ]);
        }
      }
    }
  }

  return c.text('OK');
});

// File Management with R2
app.post('/upload', authGuard, async (c) => {
  const form = await c.req.formData();
  const file = form.get('file') as File;
  
  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }

  const payload = c.get('jwtPayload') as JWTPayload;
  const extension = file.name.split('.').pop() || 'jpg';
  const key = `uploads/${payload.id}/${crypto.randomUUID()}.${extension}`;
  
  await c.env.STORAGE.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type }
  });

  return c.json({ 
    success: true, 
    url: `/api/files/${key}`,
    key
  });
});

app.get('/files/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const file = await c.env.STORAGE.get(key);

  if (!file) {
    return c.text('File not found', 404);
  }

  const headers = new Headers();
  file.writeHttpMetadata(headers);
  headers.set('etag', file.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(file.body, { headers });
});

export const onRequest = handle(app);
