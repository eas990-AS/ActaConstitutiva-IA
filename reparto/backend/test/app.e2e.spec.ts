import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AlertsService } from '../src/alerts/alerts.module';
import { AppModule } from '../src/app.module';
import { operationDate } from '../src/common/dates';
import { PrismaService } from '../src/common/prisma.service';
import { configureApp } from '../src/setup';

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const ZONE_POLYGON = [
  { lat: 19.44, lng: -99.146 },
  { lat: 19.44, lng: -99.124 },
  { lat: 19.425, lng: -99.124 },
  { lat: 19.425, lng: -99.146 },
];
const INSIDE = { lat: 19.4338, lng: -99.1386 };
const OUTSIDE = { lat: 19.5, lng: -99.2 };

describe('API de reparto (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let admin: string;
  let courier: string;
  let courierId: string;
  let zoneId: string;
  const today = operationDate();

  const login = async (username: string, password: string) =>
    (await http.post('/api/auth/login').send({ username, password }).expect(201)).body.accessToken as string;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.listen(0);
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: { name: 'Admin', username: 'admin', role: 'ADMIN', passwordHash: await bcrypt.hash('admin123', 4) },
    });
    admin = await login('admin', 'admin123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza credenciales inválidas y peticiones sin token', async () => {
    await http.post('/api/auth/login').send({ username: 'admin', password: 'mala' }).expect(401);
    await http.get('/api/packages').expect(401);
  });

  it('crea zona y repartidor', async () => {
    const zone = await http.post('/api/zones').set(as(admin)).send({ name: 'Centro', polygon: ZONE_POLYGON }).expect(201);
    zoneId = zone.body.id;
    await http.post('/api/zones').set(as(admin)).send({ name: 'Mala', polygon: [{ lat: 1, lng: 1 }] }).expect(400);

    const user = await http
      .post('/api/users')
      .set(as(admin))
      .send({ name: 'Juan', username: 'juan', password: 'reparto123', role: 'COURIER', zoneId })
      .expect(201);
    courierId = user.body.id;
    expect(user.body).not.toHaveProperty('passwordHash');
    await http
      .post('/api/users')
      .set(as(admin))
      .send({ name: 'Otro', username: 'juan', password: 'reparto123', role: 'COURIER' })
      .expect(409);
    courier = await login('juan', 'reparto123');
  });

  it('impide que un repartidor use el panel', async () => {
    await http.get('/api/packages').set(as(courier)).expect(403);
    await http.get('/api/courier/today').set(as(admin)).expect(403);
  });

  it('asigna zona y repartidor automáticamente según la ubicación', async () => {
    const res = await http
      .post('/api/packages')
      .set(as(admin))
      .send({ trackingCode: 'A-1', recipientName: 'Ana', address: 'Madero 1', location: INSIDE, scheduledDate: today })
      .expect(201);
    expect(res.body).toMatchObject({ zoneId, courierId, status: 'ASSIGNED' });

    const outside = await http
      .post('/api/packages')
      .set(as(admin))
      .send({ trackingCode: 'A-2', recipientName: 'Beto', address: 'Lejos', location: OUTSIDE, scheduledDate: today })
      .expect(201);
    expect(outside.body).toMatchObject({ zoneId: null, courierId: null, status: 'REGISTERED' });

    await http
      .post('/api/packages')
      .set(as(admin))
      .send({ trackingCode: 'A-1', recipientName: 'Dup', address: 'x calle', scheduledDate: today })
      .expect(409);
  });

  it('importa CSV y reporta errores por renglón', async () => {
    const csv = [
      'trackingCode,recipientName,recipientPhone,address,lat,lng,notes,scheduledDate',
      `B-1,Carla,555,"Bolívar 21, Centro",19.431,-99.1393,,${today}`,
      `B-2,Dani,,Donceles 80,19.4363,-99.1366,Tocar fuerte,${today}`,
      `B-3,Sin fecha,,Calle 1,,,,`,
      `A-1,Repetido,,Calle 2,,,,${today}`,
      `B-4,Coordenadas malas,,Calle 3,abc,-99,,${today}`,
    ].join('\n');
    const res = await http
      .post('/api/packages/import')
      .set(as(admin))
      .attach('file', Buffer.from(csv), 'paquetes.csv')
      .expect(201);
    expect(res.body.created).toBe(2);
    expect(res.body.errors.map((e: { line: number }) => e.line)).toEqual([4, 5, 6]);
  });

  let routeId: string;
  let pkgIds: string[];

  it('inicia recorrido y pasa los paquetes a EN RUTA', async () => {
    const before = await http.get('/api/courier/today').set(as(courier)).expect(200);
    expect(before.body.route).toBeNull();
    expect(before.body.zone.name).toBe('Centro');
    expect(before.body.packages).toHaveLength(3);
    await http.post('/api/courier/locations').set(as(courier)).send({ points: [{ ...INSIDE, recordedAt: new Date().toISOString() }] }).expect(409);

    const route = await http.post('/api/courier/routes/start').set(as(courier)).send({ location: INSIDE }).expect(201);
    routeId = route.body.id;
    // Reintento idempotente
    const again = await http.post('/api/courier/routes/start').set(as(courier)).send({ location: INSIDE }).expect(201);
    expect(again.body.id).toBe(routeId);

    const after = await http.get('/api/courier/today').set(as(courier)).expect(200);
    expect(after.body.route.id).toBe(routeId);
    expect(after.body.packages.every((p: { status: string }) => p.status === 'IN_ROUTE')).toBe(true);
    pkgIds = after.body.packages.map((p: { id: string }) => p.id);
  });

  it('recibe ubicaciones, emite en vivo y genera alertas', async () => {
    const { port } = app.getHttpServer().address() as AddressInfo;
    const socket: Socket = io(`http://localhost:${port}/live`, { auth: { token: admin }, transports: ['websocket'] });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    const events: { name: string; payload: any }[] = [];
    socket.onAny((name, payload) => events.push({ name, payload }));

    const t0 = Date.now();
    const res = await http
      .post('/api/courier/locations')
      .set(as(courier))
      .send({
        points: [
          { ...INSIDE, battery: 0.5, recordedAt: new Date(t0 - 20_000).toISOString() },
          { lat: INSIDE.lat + 0.001, lng: INSIDE.lng, battery: 0.5, recordedAt: new Date(t0 - 10_000).toISOString() },
          { ...OUTSIDE, battery: 0.1, speed: 3, recordedAt: new Date(t0).toISOString() },
        ],
      })
      .expect(201);
    expect(res.body.accepted).toBe(3);
    await new Promise((r) => setTimeout(r, 300));
    socket.close();

    expect(events.find((e) => e.name === 'location')?.payload).toMatchObject({ courierId, point: { lat: OUTSIDE.lat } });
    const alertTypes = events.filter((e) => e.name === 'alert').map((e) => e.payload.type).sort();
    expect(alertTypes).toEqual(['LOW_BATTERY', 'OUT_OF_ZONE']);

    // No se duplican mientras sigan sin atender
    await http
      .post('/api/courier/locations')
      .set(as(courier))
      .send({ points: [{ ...OUTSIDE, battery: 0.09, recordedAt: new Date().toISOString() }] })
      .expect(201);
    const alerts = await http.get('/api/alerts?pending=true').set(as(admin)).expect(200);
    expect(alerts.body).toHaveLength(2);
    const acked = await http.post(`/api/alerts/${alerts.body[0].id}/ack`).set(as(admin)).expect(201);
    expect(acked.body.acknowledgedAt).not.toBeNull();

    const live = await http.get('/api/tracking/live').set(as(admin)).expect(200);
    expect(live.body[0]).toMatchObject({ state: 'MOVING', progress: { total: 3, pending: 3 } });

    const route = await prisma.route.findUniqueOrThrow({ where: { id: routeId } });
    expect(route.distanceKm).toBeGreaterThan(5);
  });

  it('valida evidencia y distancia al entregar', async () => {
    const id = pkgIds[0];
    const base = () =>
      http
        .post(`/api/courier/packages/${id}/deliver`)
        .set(as(courier))
        .field('clientId', randomUUID())
        .field('occurredAt', new Date().toISOString());

    await base().field('lat', INSIDE.lat).field('lng', INSIDE.lng).expect(400); // sin foto
    const far = await base()
      .field('lat', OUTSIDE.lat)
      .field('lng', OUTSIDE.lng)
      .attach('photos', PNG, { filename: 'p.png', contentType: 'image/png' })
      .expect(422);
    expect(far.body.code).toBe('DISTANCE_JUSTIFICATION_REQUIRED');
    await base()
      .field('lat', INSIDE.lat)
      .field('lng', INSIDE.lng)
      .attach('photos', Buffer.from('hola'), { filename: 'p.txt', contentType: 'text/plain' })
      .expect(400);
  });

  let attemptId: string;
  let evidenceUrl: string;

  it('registra la entrega con foto, de forma idempotente', async () => {
    const pkg = await prisma.package.findUniqueOrThrow({ where: { id: pkgIds[0] } });
    const clientId = randomUUID();
    const send = () =>
      http
        .post(`/api/courier/packages/${pkg.id}/deliver`)
        .set(as(courier))
        .field('clientId', clientId)
        .field('lat', pkg.lat! + 0.0002)
        .field('lng', pkg.lng!)
        .field('recipientName', 'Ana')
        .field('occurredAt', new Date().toISOString())
        .attach('photos', PNG, { filename: 'p.png', contentType: 'image/png' })
        .attach('signature', PNG, { filename: 'f.png', contentType: 'image/png' });

    const first = await send().expect(201);
    expect(first.body).toMatchObject({ result: 'DELIVERED', routeId, recipientName: 'Ana' });
    expect(first.body.distanceMeters).toBeLessThan(50);
    expect(first.body.evidences.map((e: { kind: string }) => e.kind).sort()).toEqual(['PACKAGE_PHOTO', 'SIGNATURE']);
    attemptId = first.body.id;
    evidenceUrl = first.body.evidences[0].url;

    const second = await send().expect(201);
    expect(second.body.id).toBe(attemptId);
    expect(await prisma.deliveryAttempt.count({ where: { packageId: pkg.id } })).toBe(1);
    expect((await prisma.package.findUniqueOrThrow({ where: { id: pkg.id } })).status).toBe('DELIVERED');
  });

  it('sirve evidencias solo con firma válida', async () => {
    const ok = await http.get(evidenceUrl).expect(200);
    expect(ok.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(ok.body, PNG)).toBe(0);
    await http.get(evidenceUrl.replace(/sig=[0-9a-f]+/, 'sig=00')).expect(403);
  });

  it('registra una entrega fallida con motivo y foto de fachada', async () => {
    const id = pkgIds[1];
    const post = (reason: string, comment?: string) => {
      const r = http
        .post(`/api/courier/packages/${id}/fail`)
        .set(as(courier))
        .field('clientId', randomUUID())
        .field('reason', reason)
        .field('lat', INSIDE.lat)
        .field('lng', INSIDE.lng)
        .attach('photos', PNG, { filename: 'f.png', contentType: 'image/png' });
      return comment ? r.field('comment', comment) : r;
    };
    await post('OTHER').expect(400);
    await post('INVENTADO').expect(400);
    const res = await post('NO_ONE_HOME').expect(201);
    expect(res.body).toMatchObject({ result: 'FAILED', failReason: 'NO_ONE_HOME' });
    expect(res.body.evidences[0].kind).toBe('FACADE_PHOTO');

    const detail = await http.get(`/api/packages/${id}`).set(as(admin)).expect(200);
    expect(detail.body).toMatchObject({ status: 'FAILED', attempts: 1 });
    expect(detail.body.history).toHaveLength(1);
  });

  it('cierra el recorrido con resumen y deja pendientes como asignados', async () => {
    const res = await http.post(`/api/courier/routes/${routeId}/end`).set(as(courier)).send({ location: INSIDE }).expect(201);
    expect(res.body.summary).toEqual({ delivered: 1, failed: 1, pending: 1 });
    expect(res.body.endedAt).not.toBeNull();
    const pending = await prisma.package.findUniqueOrThrow({ where: { id: pkgIds[2] } });
    expect(pending.status).toBe('ASSIGNED');

    const path = await http.get(`/api/tracking/routes/${routeId}/path`).set(as(admin)).expect(200);
    expect(path.body.points.length).toBeGreaterThanOrEqual(4);
    expect(path.body.attempts).toHaveLength(2);
  });

  it('reprograma y devuelve paquetes no entregados', async () => {
    const failed = pkgIds[1];
    await http.post(`/api/packages/${failed}/reschedule`).set(as(admin)).send({ scheduledDate: '2000-01-01' }).expect(400);
    const tomorrow = operationDate(new Date(Date.now() + 86_400_000));
    const res = await http.post(`/api/packages/${failed}/reschedule`).set(as(admin)).send({ scheduledDate: tomorrow }).expect(201);
    expect(res.body).toMatchObject({ status: 'ASSIGNED', scheduledDate: tomorrow, courierId });

    const ret = await http.post(`/api/packages/${failed}/return`).set(as(admin)).expect(201);
    expect(ret.body.status).toBe('RETURNED');
    await http.post(`/api/packages/${failed}/return`).set(as(admin)).expect(409);
    await http.post(`/api/packages/${pkgIds[0]}/assign`).set(as(admin)).send({ courierId }).expect(409);
  });

  it('genera el reporte diario y el CSV', async () => {
    const res = await http.get(`/api/reports/daily?date=${today}`).set(as(admin)).expect(200);
    // Hoy: A-1, A-2, B-1 y B-2, menos el que se reprogramó para mañana
    expect(res.body.totals).toMatchObject({ total: 3, delivered: 1, failed: 0 });
    expect(res.body.byCourier[0]).toMatchObject({ courierName: 'Juan', delivered: 1 });
    expect(res.body.failureReasons).toEqual([]);

    const csv = await http.get(`/api/reports/daily.csv?date=${today}`).set(as(admin)).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\r\n')[0]).toContain('Guía');
    expect(csv.text).toContain('Entregado');
  });

  it('limita al supervisor a su zona', async () => {
    const other = await http
      .post('/api/zones')
      .set(as(admin))
      .send({ name: 'Otra', polygon: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }] })
      .expect(201);
    await http
      .post('/api/users')
      .set(as(admin))
      .send({ name: 'Sup', username: 'sup', password: 'super123', role: 'SUPERVISOR', zoneId: other.body.id })
      .expect(201);
    const sup = await login('sup', 'super123');
    expect((await http.get(`/api/packages?date=${today}`).set(as(sup)).expect(200)).body).toEqual([]);
    await http.get(`/api/packages?zoneId=${zoneId}`).set(as(sup)).expect(403);
    await http.get(`/api/packages/${pkgIds[0]}`).set(as(sup)).expect(403);
    await http.get('/api/users').set(as(sup)).expect(403);
    await http.post('/api/zones').set(as(sup)).send({ name: 'x', polygon: ZONE_POLYGON }).expect(403);
  });

  it('alerta de sin señal en recorridos abiertos sin ubicaciones', async () => {
    await prisma.route.create({
      data: {
        courierId,
        date: today,
        startedAt: new Date(Date.now() - 30 * 60_000),
      },
    });
    await app.get(AlertsService).checkNoSignal();
    const alerts = await http.get('/api/alerts?pending=true').set(as(admin)).expect(200);
    expect(alerts.body.map((a: { type: string }) => a.type)).toContain('NO_SIGNAL');
  });

  it('el botón de emergencia siempre crea alerta', async () => {
    await http.post('/api/courier/panic').set(as(courier)).send({ location: INSIDE }).expect(201);
    await http.post('/api/courier/panic').set(as(courier)).send({ location: INSIDE }).expect(201);
    const alerts = await prisma.alert.count({ where: { type: 'PANIC' } });
    expect(alerts).toBe(2);
  });
});
