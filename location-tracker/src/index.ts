import { DurableObject } from '@cloudflare/workers-types';

export class LocationTracker implements DurableObject {
  sessions: Set<WebSocket> = new Set();
  driverLocations: Map<string, any> = new Map();

  constructor(public state: any, public env: any) {}

  async fetch(request: Request) {
    if (request.method === 'POST') {
      try {
        const data: any = await request.json();
        if (data.type === 'ride_unavailable') {
          this.broadcast({ type: 'ride_unavailable', id: data.id });
          return new Response('OK');
        }
      } catch (e) {
        return new Response('Internal Error', { status: 500 });
      }
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // @ts-ignore
    const { 0: client, 1: server } = new WebSocketPair();
    this.handleSession(server);

    return new Response(null, {
      status: 101,
      // @ts-ignore
      webSocket: client,
    });
  }

  handleSession(ws: WebSocket) {
    // @ts-ignore
    ws.accept();
    this.sessions.add(ws);

    // Limpieza proactiva: No enviar conductores que no se han actualizado en 3 minutos
    const now = Date.now();
    const threeMinutes = 3 * 60 * 1000;
    
    // Send current locations to the new client (filtering stale ones)
    const initialData = Array.from(this.driverLocations.entries())
      .filter(([_, data]) => (now - data.lastUpdate) < threeMinutes)
      .map(([id, data]) => ({
        id,
        ...data
      }));
    
    ws.send(JSON.stringify({ type: 'initial_drivers', drivers: initialData }));

    ws.addEventListener('message', (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        
        if (data.type === 'update_location') {
          const { id, lat, lng, vehicleType, status } = data;
          const driverData = { 
            position: [lat, lng], 
            type: vehicleType, 
            status: status || 'available',
            lastUpdate: Date.now() 
          };
          this.driverLocations.set(id, driverData);
          
          // Programar una limpieza si no hay un alarma pendiente
          this.state.storage.setAlarm(Date.now() + 60 * 1000); // Revisar en 1 minuto

          // Broadcast to all
          this.broadcast({
            type: 'driver_updated',
            driver: { id, ...driverData }
          });
        }
      } catch (err) {
        console.error('DO Message Error:', err);
      }
    });

    ws.addEventListener('close', () => {
      this.sessions.delete(ws);
    });

    ws.addEventListener('error', () => {
      this.sessions.delete(ws);
    });
  }

  // Método de limpieza automática (Cloudflare Alarms)
  async alarm() {
    const now = Date.now();
    const threeMinutes = 3 * 60 * 1000;
    let deletedCount = 0;

    for (const [id, data] of this.driverLocations.entries()) {
      if ((now - data.lastUpdate) > threeMinutes) {
        this.driverLocations.delete(id);
        deletedCount++;
        // Notificar a todos que este conductor ya no está disponible
        this.broadcast({ type: 'driver_removed', id });
      }
    }

    if (deletedCount > 0) {
      console.log(`[LocationTracker] ${deletedCount} conductores fantasma eliminados.`);
    }

    // Volver a programar si aún hay conductores
    if (this.driverLocations.size > 0) {
      this.state.storage.setAlarm(Date.now() + 60 * 1000);
    }
  }

  broadcast(message: any) {
    const data = JSON.stringify(message);
    this.sessions.forEach(ws => {
      try {
        ws.send(data);
      } catch (e) {
        this.sessions.delete(ws);
      }
    });
  }
}

export default {
  async fetch(request: Request, env: any) {
    return new Response('Location Tracker Worker is running', { status: 200 });
  }
};
