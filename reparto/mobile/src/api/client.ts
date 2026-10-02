import { API_URL } from '../config';
import { getToken } from '../auth/tokenStore';
import type {
  Alert,
  ApiErrorBody,
  CourierToday,
  DeliveryAttempt,
  EndRouteResponse,
  FailReason,
  LatLng,
  LocationPoint,
  LocationsResponse,
  LoginResponse,
  Route,
  User,
} from './types';

/** Error de la API. `status === 0` significa que no hubo respuesta (sin red, tiempo agotado). */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }

  /** Errores que no tiene caso reintentar tal cual (4xx salvo 401/408/429). */
  get isPermanent(): boolean {
    return (
      this.status >= 400 &&
      this.status < 500 &&
      this.status !== 401 &&
      this.status !== 408 &&
      this.status !== 429
    );
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Se llama cuando la API responde 401 (token vencido o inválido). */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

/** Archivo para subir en multipart (React Native acepta este objeto en FormData). */
export interface UploadFile {
  uri: string;
  name: string;
  type: 'image/jpeg' | 'image/png';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  json?: unknown;
  form?: FormData;
  auth?: boolean;
  timeoutMs?: number;
  token?: string | null;
}

function messageFromBody(body: unknown, status: number): { message: string; code?: string } {
  if (body && typeof body === 'object') {
    const b = body as Partial<ApiErrorBody>;
    const msg = Array.isArray(b.message) ? b.message.join('\n') : b.message;
    return { message: msg || `Error ${status}`, code: typeof b.code === 'string' ? b.code : undefined };
  }
  return { message: `Error ${status}` };
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', json, form, auth = true, timeoutMs = 30000 } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth) {
    const token = opts.token !== undefined ? opts.token : await getToken();
    if (!token) throw new ApiError(401, 'Sesión no iniciada');
    headers.Authorization = `Bearer ${token}`;
  }
  let body: string | FormData | undefined;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    // No fijar Content-Type: fetch agrega el boundary del multipart.
    body = form;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body, signal: controller.signal });
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text().catch(() => '');
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }
  if (!res.ok) {
    const { message, code } = messageFromBody(parsed, res.status);
    if (res.status === 401 && auth) unauthorizedListeners.forEach((l) => l());
    throw new ApiError(res.status, message, code);
  }
  return parsed as T;
}

// ---- Autenticación ----

export function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    json: { username, password },
    auth: false,
  });
}

export function getMe(token?: string): Promise<User> {
  return request<User>('/auth/me', { token });
}

// ---- App del repartidor ----

export function getToday(): Promise<CourierToday> {
  return request<CourierToday>('/courier/today');
}

export function startRoute(location: LatLng, startedAt?: string): Promise<Route> {
  return request<Route>('/courier/routes/start', { method: 'POST', json: { location, startedAt } });
}

export function endRoute(routeId: string, location: LatLng, endedAt?: string): Promise<EndRouteResponse> {
  return request<EndRouteResponse>(`/courier/routes/${encodeURIComponent(routeId)}/end`, {
    method: 'POST',
    json: { location, endedAt },
  });
}

export function postLocations(points: LocationPoint[]): Promise<LocationsResponse> {
  return request<LocationsResponse>('/courier/locations', { method: 'POST', json: { points } });
}

export interface DeliverInput {
  clientId: string;
  location: LatLng;
  occurredAt: string;
  recipientName?: string;
  comment?: string;
  distanceJustification?: string;
  photos: UploadFile[];
  signature?: UploadFile;
}

export interface FailInput {
  clientId: string;
  location: LatLng;
  occurredAt: string;
  reason: FailReason;
  comment?: string;
  photo: UploadFile;
}

function appendFile(form: FormData, field: string, file: UploadFile): void {
  // React Native serializa { uri, name, type } como archivo del multipart.
  form.append(field, file as unknown as Blob);
}

function appendIf(form: FormData, field: string, value: string | undefined): void {
  if (value !== undefined && value.trim() !== '') form.append(field, value);
}

export function deliverPackage(packageId: string, input: DeliverInput): Promise<DeliveryAttempt> {
  const form = new FormData();
  form.append('clientId', input.clientId);
  form.append('lat', String(input.location.lat));
  form.append('lng', String(input.location.lng));
  form.append('occurredAt', input.occurredAt);
  appendIf(form, 'recipientName', input.recipientName);
  appendIf(form, 'comment', input.comment);
  appendIf(form, 'distanceJustification', input.distanceJustification);
  input.photos.forEach((p) => appendFile(form, 'photos', p));
  if (input.signature) appendFile(form, 'signature', input.signature);
  return request<DeliveryAttempt>(`/courier/packages/${encodeURIComponent(packageId)}/deliver`, {
    method: 'POST',
    form,
    timeoutMs: 120000,
  });
}

export function failPackage(packageId: string, input: FailInput): Promise<DeliveryAttempt> {
  const form = new FormData();
  form.append('clientId', input.clientId);
  form.append('lat', String(input.location.lat));
  form.append('lng', String(input.location.lng));
  form.append('occurredAt', input.occurredAt);
  form.append('reason', input.reason);
  appendIf(form, 'comment', input.comment);
  appendFile(form, 'photos', input.photo);
  return request<DeliveryAttempt>(`/courier/packages/${encodeURIComponent(packageId)}/fail`, {
    method: 'POST',
    form,
    timeoutMs: 120000,
  });
}

export function sendPanic(location: LatLng): Promise<Alert> {
  return request<Alert>('/courier/panic', { method: 'POST', json: { location }, timeoutMs: 15000 });
}
