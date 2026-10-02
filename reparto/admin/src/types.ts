// Tipos copiados del contrato de la API (reparto/docs/API.md).

export type Role = 'ADMIN' | 'SUPERVISOR' | 'COURIER';

export type PackageStatus =
  | 'REGISTERED'
  | 'ASSIGNED'
  | 'IN_ROUTE'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED';

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
  color: string;
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
  scheduledDate: string;
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
  speed?: number;
  battery?: number;
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

export type CourierState = 'MOVING' | 'STOPPED' | 'NO_SIGNAL' | 'OFF';

export interface Progress {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
}

export interface LiveCourier {
  courier: { id: string; name: string; zoneId: string | null };
  route: Route | null;
  last: LocationPoint | null;
  state: CourierState;
  progress: Progress;
}

export interface Totals {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  returned: number;
  effectiveness: number;
}

export interface DailyReport {
  date: string;
  totals: Totals;
  byZone: ({ zoneId: string | null; zoneName: string } & Totals)[];
  byCourier: ({ courierId: string; courierName: string; distanceKm: number } & Totals)[];
  failureReasons: { reason: FailReason; count: number }[];
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export type PackageDetail = Package & { history: DeliveryAttempt[] };

export interface ImportResult {
  created: number;
  errors: { line: number; message: string }[];
}

export interface RoutePath {
  route: Route;
  points: LocationPoint[];
  attempts: DeliveryAttempt[];
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  code?: string;
}

// Eventos de Socket.IO (namespace /live)
export interface LocationEvent {
  courierId: string;
  point: LocationPoint;
}
export interface RouteEvent {
  courierId: string;
  route: Route;
  event: 'start' | 'end';
}
export interface AttemptEvent {
  courierId: string;
  attempt: DeliveryAttempt;
  package: Package;
}

// Cuerpos de petición
export interface CreatePackageBody {
  trackingCode: string;
  recipientName: string;
  recipientPhone?: string;
  address: string;
  location?: LatLng;
  notes?: string;
  scheduledDate: string;
}

export interface CreateUserBody {
  name: string;
  username: string;
  password: string;
  role: Role;
  phone?: string;
  zoneId?: string;
}

export interface UpdateUserBody {
  name?: string;
  password?: string;
  phone?: string;
  /** null para quitar la zona (no especificado en el contrato). */
  zoneId?: string | null;
  active?: boolean;
}

export interface ZoneBody {
  name: string;
  color?: string;
  polygon: LatLng[];
}
