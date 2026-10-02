/** Zona horaria de los días de operación (igual que `TZ` del servidor). */
export const OPERATION_TZ: string = import.meta.env.VITE_TZ || 'America/Mexico_City';

/** Fecha de hoy en la zona horaria de operación como YYYY-MM-DD. */
export function today(): string {
  try {
    // en-CA formatea como AAAA-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: OPERATION_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

const dateTimeFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' });
const timeFmt = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' });

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : dateTimeFmt.format(d);
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : timeFmt.format(d);
}

/** "hace 5 min" */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'hace un momento';
  if (diff < 60) return `hace ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `hace ${h} h ${diff % 60} min`;
  return fmtDateTime(iso);
}

export function fmtPct(v: number): string {
  return `${(v * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`;
}

export function fmtKm(v: number): string {
  return `${v.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`;
}

export function fmtMeters(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v >= 1000 ? fmtKm(v / 1000) : `${Math.round(v)} m`;
}

export function fmtBattery(v: number | undefined): string {
  return v === undefined ? '—' : `${Math.round(v * 100)} %`;
}

/** Centro por defecto de los mapas (CDMX). */
export const DEFAULT_CENTER: [number, number] = [19.4326, -99.1332];

export function downloadText(content: string, filename: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Distancia en metros entre dos coordenadas (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
