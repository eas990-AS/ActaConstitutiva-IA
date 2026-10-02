import type {
  Alert,
  DeliveryAttempt,
  Evidence,
  LocationPoint,
  Package,
  Route,
  User,
  Zone,
} from '@prisma/client';
import type { LatLng } from './geo';
import type { StorageService } from './storage.service';

const loc = (lat: number | null, lng: number | null): LatLng | null =>
  lat === null || lng === null ? null : { lat, lng };

export const toUser = (u: User) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  role: u.role,
  phone: u.phone,
  zoneId: u.zoneId,
  active: u.active,
});

export const toZone = (z: Zone) => ({
  id: z.id,
  name: z.name,
  color: z.color,
  polygon: z.polygon as unknown as LatLng[],
  active: z.active,
});

export const toPackage = (p: Package) => ({
  id: p.id,
  trackingCode: p.trackingCode,
  recipientName: p.recipientName,
  recipientPhone: p.recipientPhone,
  address: p.address,
  location: loc(p.lat, p.lng),
  notes: p.notes,
  scheduledDate: p.scheduledDate,
  status: p.status,
  attempts: p.attempts,
  zoneId: p.zoneId,
  courierId: p.courierId,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

export const toRoute = (r: Route) => ({
  id: r.id,
  courierId: r.courierId,
  date: r.date,
  startedAt: r.startedAt.toISOString(),
  startLocation: loc(r.startLat, r.startLng),
  endedAt: r.endedAt ? r.endedAt.toISOString() : null,
  endLocation: loc(r.endLat, r.endLng),
  distanceKm: Math.round(r.distanceKm * 100) / 100,
});

export const toPoint = (p: LocationPoint) => ({
  lat: p.lat,
  lng: p.lng,
  accuracy: p.accuracy ?? undefined,
  speed: p.speed ?? undefined,
  battery: p.battery ?? undefined,
  recordedAt: p.recordedAt.toISOString(),
});

export const toAttempt = (
  a: DeliveryAttempt & { evidences: Evidence[] },
  storage: StorageService,
) => ({
  id: a.id,
  packageId: a.packageId,
  routeId: a.routeId,
  courierId: a.courierId,
  result: a.result,
  failReason: a.failReason,
  recipientName: a.recipientName,
  comment: a.comment,
  distanceJustification: a.distanceJustification,
  location: loc(a.lat, a.lng),
  distanceMeters: a.distanceMeters === null ? null : Math.round(a.distanceMeters),
  occurredAt: a.occurredAt.toISOString(),
  evidences: a.evidences.map((e) => ({
    id: e.id,
    kind: e.kind,
    url: storage.signedUrl(e.id),
    sha256: e.sha256,
    createdAt: e.createdAt.toISOString(),
  })),
});

export const toAlert = (a: Alert & { courier: { name: string } }) => ({
  id: a.id,
  type: a.type,
  courierId: a.courierId,
  courierName: a.courier.name,
  message: a.message,
  location: loc(a.lat, a.lng),
  createdAt: a.createdAt.toISOString(),
  acknowledgedAt: a.acknowledgedAt ? a.acknowledgedAt.toISOString() : null,
});
