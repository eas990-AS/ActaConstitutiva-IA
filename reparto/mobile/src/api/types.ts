// Tipos copiados de reparto/docs/API.md (sección "Tipos" y "App del repartidor").

export type Role = 'ADMIN' | 'SUPERVISOR' | 'COURIER';

export type PackageStatus =
  | 'REGISTERED' // sin repartidor
  | 'ASSIGNED' // tiene repartidor, recorrido no iniciado
  | 'IN_ROUTE' // el repartidor inició su recorrido
  | 'DELIVERED'
  | 'FAILED' // intento fallido; espera reprogramar o devolver
  | 'RETURNED'; // devuelto al remitente (final)

export type FailReason = 'NO_ONE_HOME' | 'WRONG_ADDRESS' | 'REJECTED' | 'UNSAFE_AREA' | 'OTHER';

export type EvidenceKind = 'PACKAGE_PHOTO' | 'FACADE_PHOTO' | 'SIGNATURE';

export type AlertType = 'OUT_OF_ZONE' | 'LOW_BATTERY' | 'NO_SIGNAL' | 'PANIC';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  phone: string | null;
  zoneId: string | null;
  active: boolean;
}

export interface Zone {
  id: string;
  name: string;
  color: string; // '#RRGGBB'
  polygon: LatLng[];
  active: boolean;
}

export interface Package {
  id: string;
  trackingCode: string;
  recipientName: string;
  recipientPhone: string | null;
  address: string;
  location: LatLng | null;
  notes: string | null;
  scheduledDate: string; // 'YYYY-MM-DD'
  status: PackageStatus;
  attempts: number;
  zoneId: string | null;
  courierId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  url: string;
  sha256: string;
  createdAt: string;
}

export interface DeliveryAttempt {
  id: string;
  packageId: string;
  routeId: string | null;
  courierId: string;
  result: 'DELIVERED' | 'FAILED';
  failReason: FailReason | null;
  recipientName: string | null;
  comment: string | null;
  distanceJustification: string | null;
  location: LatLng | null;
  distanceMeters: number | null;
  occurredAt: string;
  evidences: Evidence[];
}

export interface Route {
  id: string;
  courierId: string;
  date: string;
  startedAt: string;
  startLocation: LatLng | null;
  endedAt: string | null;
  endLocation: LatLng | null;
  distanceKm: number;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number; // m/s
  battery?: number; // 0..1
  recordedAt: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  courierId: string;
  courierName: string;
  message: string;
  location: LatLng | null;
  createdAt: string;
  acknowledgedAt: string | null;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  code?: string;
}

// ---- Respuestas de la app del repartidor ----

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface CourierToday {
  route: Route | null;
  zone: Zone | null;
  packages: Package[];
}

export interface RouteSummary {
  delivered: number;
  failed: number;
  pending: number;
}

export type EndRouteResponse = Route & { summary: RouteSummary };

export interface LocationsResponse {
  accepted: number;
}
