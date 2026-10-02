import type {
  Alert,
  ApiErrorBody,
  CreatePackageBody,
  CreateUserBody,
  DailyReport,
  ImportResult,
  LiveCourier,
  LoginResponse,
  Package,
  PackageDetail,
  PackageStatus,
  Role,
  Route,
  RoutePath,
  UpdateUserBody,
  User,
  Zone,
  ZoneBody,
} from './types';

/** Origen del backend. Vacío = mismo origen (proxy de Vite en desarrollo). */
export const BASE_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const API_URL = `${BASE_URL}/api`;

const TOKEN_KEY = 'reparto.token';
const USER_KEY = 'reparto.user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
export function storeSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Se invoca cuando el servidor responde 401 (sesión expirada). */
let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Convierte URLs relativas del servidor (p. ej. evidencias) en absolutas si hay VITE_API_URL. */
export function resolveUrl(url: string): string {
  return url.startsWith('/') ? `${BASE_URL}${url}` : url;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function qs(query?: Query): string {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function raw(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs(opts.query)}`, { method, headers, body });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.');
  }
  if (!res.ok) {
    let message = `Error ${res.status}`;
    let code: string | undefined;
    try {
      const data = (await res.json()) as Partial<ApiErrorBody>;
      if (Array.isArray(data.message)) message = data.message.join('; ');
      else if (data.message) message = data.message;
      code = data.code;
    } catch {
      /* cuerpo no JSON */
    }
    if (res.status === 401 && path === '/auth/login') {
      message = 'Usuario o contraseña incorrectos.';
    } else if (res.status === 401) {
      unauthorizedHandler?.();
      message = 'Tu sesión expiró. Inicia sesión de nuevo.';
    }
    if (res.status === 403 && message === `Error 403`) message = 'No tienes permiso para esta acción.';
    throw new ApiError(res.status, message, code);
  }
  return res;
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const res = await raw(method, path, opts);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function download(path: string, query: Query, filename: string): Promise<void> {
  const res = await raw('GET', path, { query });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface PackageFilters {
  date?: string;
  zoneId?: string;
  courierId?: string;
  status?: PackageStatus | '';
  q?: string;
}

export const api = {
  // Autenticación
  login: (username: string, password: string) =>
    request<LoginResponse>('POST', '/auth/login', { body: { username, password } }),
  me: () => request<User>('GET', '/auth/me'),

  // Zonas
  zones: () => request<Zone[]>('GET', '/zones'),
  createZone: (body: ZoneBody) => request<Zone>('POST', '/zones', { body }),
  updateZone: (id: string, body: Partial<ZoneBody>) => request<Zone>('PATCH', `/zones/${id}`, { body }),
  deleteZone: (id: string) => request<void>('DELETE', `/zones/${id}`),

  // Usuarios
  users: (query: { role?: Role; zoneId?: string } = {}) => request<User[]>('GET', '/users', { query: { ...query } }),
  createUser: (body: CreateUserBody) => request<User>('POST', '/users', { body }),
  updateUser: (id: string, body: UpdateUserBody) => request<User>('PATCH', `/users/${id}`, { body }),

  // Paquetes
  packages: (filters: PackageFilters = {}) => request<Package[]>('GET', '/packages', { query: { ...filters } }),
  package: (id: string) => request<PackageDetail>('GET', `/packages/${id}`),
  createPackage: (body: CreatePackageBody) => request<Package>('POST', '/packages', { body }),
  importPackages: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportResult>('POST', '/packages/import', { body: fd });
  },
  assign: (id: string, courierId: string) => request<Package>('POST', `/packages/${id}/assign`, { body: { courierId } }),
  reschedule: (id: string, scheduledDate: string, courierId?: string) =>
    request<Package>('POST', `/packages/${id}/reschedule`, {
      body: courierId ? { scheduledDate, courierId } : { scheduledDate },
    }),
  returnPackage: (id: string) => request<Package>('POST', `/packages/${id}/return`),

  // Rastreo
  live: (zoneId?: string) => request<LiveCourier[]>('GET', '/tracking/live', { query: { zoneId } }),
  routes: (query: { date?: string; courierId?: string }) =>
    request<Route[]>('GET', '/tracking/routes', { query: { ...query } }),
  routePath: (id: string) => request<RoutePath>('GET', `/tracking/routes/${id}/path`),

  // Alertas
  alerts: (query: { date?: string; pending?: boolean }) =>
    request<Alert[]>('GET', '/alerts', { query: { date: query.date, pending: query.pending ? 'true' : undefined } }),
  ackAlert: (id: string) => request<Alert>('POST', `/alerts/${id}/ack`),

  // Reportes
  dailyReport: (date: string, zoneId?: string) =>
    request<DailyReport>('GET', '/reports/daily', { query: { date, zoneId } }),
  downloadDailyCsv: (date: string, zoneId?: string) =>
    download('/reports/daily.csv', { date, zoneId }, `reporte-${date}${zoneId ? '-zona' : ''}.csv`),
};

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Ocurrió un error inesperado.';
}
