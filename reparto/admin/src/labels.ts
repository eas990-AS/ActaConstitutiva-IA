import type { AlertType, CourierState, EvidenceKind, FailReason, PackageStatus, Role } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  COURIER: 'Repartidor',
};

export const STATUS_LABEL: Record<PackageStatus, string> = {
  REGISTERED: 'Registrado',
  ASSIGNED: 'Asignado',
  IN_ROUTE: 'En ruta',
  DELIVERED: 'Entregado',
  FAILED: 'No entregado',
  RETURNED: 'Devuelto',
};
export const STATUSES = Object.keys(STATUS_LABEL) as PackageStatus[];

export const FAIL_REASON_LABEL: Record<FailReason, string> = {
  NO_ONE_HOME: 'No había nadie',
  WRONG_ADDRESS: 'Dirección incorrecta',
  REJECTED: 'Rechazado por el destinatario',
  UNSAFE_AREA: 'Zona insegura',
  OTHER: 'Otro motivo',
};

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  PACKAGE_PHOTO: 'Foto del paquete',
  FACADE_PHOTO: 'Foto de fachada',
  SIGNATURE: 'Firma',
};

export const ALERT_LABEL: Record<AlertType, string> = {
  OUT_OF_ZONE: 'Fuera de zona',
  LOW_BATTERY: 'Batería baja',
  NO_SIGNAL: 'Sin señal',
  PANIC: 'Botón de emergencia',
};

export const STATE_LABEL: Record<CourierState, string> = {
  MOVING: 'En movimiento',
  STOPPED: 'Detenido',
  NO_SIGNAL: 'Sin señal',
  OFF: 'Sin recorrido',
};

export const STATE_COLOR: Record<CourierState, string> = {
  MOVING: '#16a34a',
  STOPPED: '#f59e0b',
  NO_SIGNAL: '#dc2626',
  OFF: '#6b7280',
};

export const RESULT_LABEL: Record<'DELIVERED' | 'FAILED', string> = {
  DELIVERED: 'Entregado',
  FAILED: 'No entregado',
};
