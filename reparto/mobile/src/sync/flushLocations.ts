import { ApiError, postLocations } from '../api/client';
import { getToken } from '../auth/tokenStore';
import { LOCATION_BATCH_SIZE } from '../config';
import { peekPoints, removeFirst } from './locationQueue';

export type LocationFlushResult = 'done' | 'retry-later' | 'no-auth';

let inFlight: Promise<LocationFlushResult> | null = null;
let lastAttemptAt = 0;
let failures = 0;
let nextAllowedAt = 0;

async function doFlush(): Promise<LocationFlushResult> {
  lastAttemptAt = Date.now();
  if (!(await getToken())) return 'no-auth';
  // Lotes de hasta 500 puntos, en orden.
  for (let guard = 0; guard < 200; guard++) {
    const batch = await peekPoints(LOCATION_BATCH_SIZE);
    if (batch.length === 0) {
      failures = 0;
      nextAllowedAt = 0;
      return 'done';
    }
    try {
      await postLocations(batch);
      await removeFirst(batch.length);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, String(e));
      if (err.status === 401) return 'no-auth';
      if (err.isPermanent) {
        // 409 = no hay recorrido abierto; 400 = datos inválidos. Reintentar no sirve:
        // se descarta el lote para no bloquear la cola.
        console.warn(`[ubicación] lote descartado (${err.status}): ${err.message}`);
        await removeFirst(batch.length);
        continue;
      }
      failures += 1;
      nextAllowedAt = Date.now() + Math.min(5 * 60_000, 5_000 * 2 ** Math.min(failures, 6));
      return 'retry-later';
    }
  }
  return 'done';
}

/** Envía todos los puntos pendientes. `force` ignora la espera por reintentos. */
export function flushLocations(force = false): Promise<LocationFlushResult> {
  if (inFlight) return inFlight;
  if (!force && Date.now() < nextAllowedAt) return Promise.resolve('retry-later');
  inFlight = doFlush().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Para la tarea de fondo: como máximo un intento por minuto. */
export function flushLocationsThrottled(minIntervalMs = 60_000): Promise<LocationFlushResult> {
  if (Date.now() - lastAttemptAt < minIntervalMs) return Promise.resolve('retry-later');
  return flushLocations(false);
}
