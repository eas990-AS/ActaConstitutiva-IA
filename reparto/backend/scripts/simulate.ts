/**
 * Simula un día de trabajo de un repartidor usando la API real: crea paquetes de hoy
 * en su zona (si no tiene), inicia recorrido, envía GPS, entrega con foto y registra
 * un fallo. Sirve para probar el panel en vivo.
 *
 *   npm run simulate -- [usuario] [contraseña]      (por defecto juan / reparto123)
 *   API_URL=http://localhost:3000 npm run simulate
 */
import { randomUUID } from 'crypto';

const API = `${process.env.API_URL || 'http://localhost:3000'}/api`;
const [username = 'juan', password = 'reparto123'] = process.argv.slice(2);
const STEP_MS = Number(process.env.STEP_MS || 1500);

// 1x1 PNG como "foto"
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

type LatLng = { lat: number; lng: number };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${JSON.stringify(body)}`);
  return body as T;
}

const login = async (u: string, p: string) =>
  (await call<{ accessToken: string }>('/auth/login', null, { method: 'POST', body: JSON.stringify({ username: u, password: p }) }))
    .accessToken;

function centroid(polygon: LatLng[]): LatLng {
  return {
    lat: polygon.reduce((a, p) => a + p.lat, 0) / polygon.length,
    lng: polygon.reduce((a, p) => a + p.lng, 0) / polygon.length,
  };
}

/** Puntos intermedios entre a y b para simular el trayecto. */
function* walk(a: LatLng, b: LatLng, steps: number) {
  for (let i = 1; i <= steps; i++) {
    yield { lat: a.lat + ((b.lat - a.lat) * i) / steps, lng: a.lng + ((b.lng - a.lng) * i) / steps };
  }
}

async function main() {
  const token = await login(username, password);
  let today = await call<any>('/courier/today', token);

  if (today.packages.length === 0) {
    if (!today.zone) throw new Error('El repartidor no tiene zona; asígnale una en el panel');
    const admin = await login(process.env.ADMIN_USER || 'admin', process.env.ADMIN_PASSWORD || 'admin123');
    const c = centroid(today.zone.polygon);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.TZ || 'America/Mexico_City' }).format(new Date());
    for (let i = 0; i < 5; i++) {
      await call('/packages', admin, {
        method: 'POST',
        body: JSON.stringify({
          trackingCode: `SIM-${Date.now()}-${i}`,
          recipientName: ['Ana Torres', 'Luis García', 'Carmen Ruiz', 'Pedro Sánchez', 'Laura Díaz'][i],
          recipientPhone: '5500000000',
          address: `Calle de prueba ${i + 1}`,
          location: { lat: c.lat + (i - 2) * 0.0015, lng: c.lng + ((i % 2) - 0.5) * 0.002 },
          scheduledDate: day,
        }),
      });
    }
    today = await call<any>('/courier/today', token);
    console.log(`Creados ${today.packages.length} paquetes de prueba para ${day}`);
  }

  let pos: LatLng = today.zone ? centroid(today.zone.polygon) : today.packages[0].location;
  const route = today.route && !today.route.endedAt
    ? today.route
    : await call<any>('/courier/routes/start', token, { method: 'POST', body: JSON.stringify({ location: pos }) });
  console.log(`Recorrido ${route.id} iniciado`);

  let battery = 0.9;
  const pending = today.packages.filter((p: any) => ['ASSIGNED', 'IN_ROUTE'].includes(p.status) && p.location);
  for (const [i, pkg] of pending.entries()) {
    for (const p of walk(pos, pkg.location, 4)) {
      battery = Math.max(0.05, battery - 0.01);
      await call('/courier/locations', token, {
        method: 'POST',
        body: JSON.stringify({ points: [{ ...p, speed: 4, accuracy: 10, battery, recordedAt: new Date().toISOString() }] }),
      });
      await sleep(STEP_MS);
    }
    pos = pkg.location;
    const form = new FormData();
    form.set('clientId', randomUUID());
    form.set('lat', String(pos.lat));
    form.set('lng', String(pos.lng));
    form.set('occurredAt', new Date().toISOString());
    const fails = i % 4 === 3;
    if (fails) {
      form.set('reason', 'NO_ONE_HOME');
      form.set('comment', 'Toqué dos veces, nadie abrió');
      form.append('photos', new Blob([PNG], { type: 'image/png' }), 'fachada.png');
      await call(`/courier/packages/${pkg.id}/fail`, token, { method: 'POST', body: form });
    } else {
      form.set('recipientName', pkg.recipientName);
      form.append('photos', new Blob([PNG], { type: 'image/png' }), 'paquete.png');
      await call(`/courier/packages/${pkg.id}/deliver`, token, { method: 'POST', body: form });
    }
    console.log(`${fails ? '✗ No entregado' : '✓ Entregado'}: ${pkg.trackingCode} — ${pkg.address}`);
    await sleep(STEP_MS);
  }

  if (process.env.END_ROUTE === '1') {
    const end = await call<any>(`/courier/routes/${route.id}/end`, token, { method: 'POST', body: JSON.stringify({ location: pos }) });
    console.log('Recorrido cerrado:', end.summary);
  } else {
    console.log('Recorrido sigue abierto (END_ROUTE=1 para cerrarlo).');
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
