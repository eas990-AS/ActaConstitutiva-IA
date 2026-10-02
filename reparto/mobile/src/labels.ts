import type { FailReason, PackageStatus } from './api/types';

export const STATUS_LABELS: Record<PackageStatus, string> = {
  REGISTERED: 'Registrado',
  ASSIGNED: 'Asignado',
  IN_ROUTE: 'En ruta',
  DELIVERED: 'Entregado',
  FAILED: 'No entregado',
  RETURNED: 'Devuelto',
};

export const FAIL_REASON_LABELS: Record<FailReason, string> = {
  NO_ONE_HOME: 'No había nadie en el domicilio',
  WRONG_ADDRESS: 'Dirección incorrecta o no encontrada',
  REJECTED: 'El destinatario rechazó el paquete',
  UNSAFE_AREA: 'Zona insegura',
  OTHER: 'Otro motivo',
};

export const FAIL_REASONS: FailReason[] = ['NO_ONE_HOME', 'WRONG_ADDRESS', 'REJECTED', 'UNSAFE_AREA', 'OTHER'];

export const T = {
  appName: 'Reparto',
  loading: 'Cargando…',
  retry: 'Reintentar',
  cancel: 'Cancelar',
  accept: 'Aceptar',
  save: 'Guardar',
  error: 'Error',
  offline: 'Sin conexión',
  pendingSync: 'Pendiente de sincronizar',
  syncError: 'Error al sincronizar',
  trackingOn: 'Recorrido activo · compartiendo ubicación',
  trackingForegroundOnly: 'Recorrido activo · ubicación solo con la app abierta',
  trackingOff: 'Rastreo detenido',
  noPhone: 'Sin teléfono',
  noNotes: 'Sin notas',
  noLocation: 'Sin coordenadas del destino',
};

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
