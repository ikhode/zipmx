import { DurableObject } from '@cloudflare/workers-types';

export class LocationTracker implements DurableObject {
  sessions: Set<WebSocket> = new Set();
  driverLocations: Map<string, any> = new Map();

  constructor(public state: any, public env: any) {}

  async fetch(request: Request) {
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

    // Send current locations to the new client
    const initialData = Array.from(this.driverLocations.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
    
    ws.send(JSON.stringify({ type: 'initial_drivers', drivers: initialData }));

    ws.addEventListener('message', (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        
        if (data.type === 'update_location') {
          const { id, lat, lng, vehicleType } = data;
          const driverData = { position: [lat, lng], type: vehicleType, lastUpdate: Date.now() };
          this.driverLocations.set(id, driverData);
          
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
