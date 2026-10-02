import { ApiError, deliverPackage, endRoute, failPackage, type UploadFile } from '../api/client';
import { getCurrentUserId } from '../auth/session';
import { flushLocations, type LocationFlushResult } from './flushLocations';
import { countPoints } from './locationQueue';
import { fileExists } from './files';
import { getOutboxItems, loadOutbox, removeItem, updateItem, type OutboxItem, type SyncErrorInfo } from './outbox';

export interface FlushReport {
  sent: number;
  newErrors: OutboxItem[];
  blocked: boolean;
  noAuth: boolean;
}

type ErrorListener = (items: OutboxItem[]) => void;
type SyncedListener = (report: FlushReport) => void;
type BusyListener = (busy: boolean) => void;
const errorListeners = new Set<ErrorListener>();
const syncedListeners = new Set<SyncedListener>();
const busyListeners = new Set<BusyListener>();

export function onSyncErrors(l: ErrorListener): () => void {
  errorListeners.add(l);
  return () => {
    errorListeners.delete(l);
  };
}

export function onSynced(l: SyncedListener): () => void {
  syncedListeners.add(l);
  return () => {
    syncedListeners.delete(l);
  };
}

export function onBusy(l: BusyListener): () => void {
  busyListeners.add(l);
  l(inFlight !== null);
  return () => {
    busyListeners.delete(l);
  };
}

function backoffMs(attempts: number): number {
  // 5 s, 10 s, 20 s, … hasta 10 min.
  return Math.min(10 * 60_000, 5_000 * 2 ** Math.max(0, attempts - 1));
}

function asApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError(0, e instanceof Error ? e.message : String(e));
}

function upload(uri: string, name: string, type: UploadFile['type']): UploadFile {
  return { uri, name, type };
}

class MissingFilesError extends Error {}

async function send(item: OutboxItem): Promise<void> {
  switch (item.kind) {
    case 'deliver': {
      const files = [...item.data.photos, ...(item.data.signature ? [item.data.signature] : [])];
      if (!files.every(fileExists)) throw new MissingFilesError('Faltan archivos de evidencia en el teléfono.');
      await deliverPackage(item.packageId, {
        clientId: item.id,
        location: item.data.location,
        occurredAt: item.data.occurredAt,
        recipientName: item.data.recipientName,
        comment: item.data.comment,
        distanceJustification: item.data.distanceJustification,
        photos: item.data.photos.map((uri, i) => upload(uri, `foto-${i + 1}.jpg`, 'image/jpeg')),
        signature: item.data.signature ? upload(item.data.signature, 'firma.png', 'image/png') : undefined,
      });
      return;
    }
    case 'fail': {
      if (!fileExists(item.data.photo)) throw new MissingFilesError('Falta la foto de fachada en el teléfono.');
      await failPackage(item.packageId, {
        clientId: item.id,
        location: item.data.location,
        occurredAt: item.data.occurredAt,
        reason: item.data.reason,
        comment: item.data.comment,
        photo: upload(item.data.photo, 'fachada.jpg', 'image/jpeg'),
      });
      return;
    }
    case 'endRoute': {
      try {
        await endRoute(item.routeId, item.data.location, item.data.endedAt);
      } catch (e) {
        // 409: el recorrido ya estaba cerrado (p. ej. se perdió la respuesta del primer intento).
        if (e instanceof ApiError && e.status === 409) return;
        throw e;
      }
      return;
    }
  }
}

async function doFlush(force: boolean): Promise<FlushReport> {
  const report: FlushReport = { sent: 0, newErrors: [], blocked: false, noAuth: false };
  const userId = getCurrentUserId();
  if (!userId) {
    report.noAuth = true;
    return report;
  }
  await loadOutbox();

  // 1) Ubicaciones primero: después de cerrar el recorrido el servidor las rechaza (409).
  const loc: LocationFlushResult = await flushLocations(force);
  if (loc === 'no-auth') {
    report.noAuth = true;
    return report;
  }
  const pointsPending = (await countPoints()) > 0;

  // 2) Entregas, fallos y cierre de recorrido, en orden de captura (FIFO).
  for (const item of getOutboxItems()) {
    if (item.userId !== userId || item.status === 'error') continue;
    if (item.kind === 'endRoute' && pointsPending && loc !== 'done') {
      report.blocked = true;
      break;
    }
    if (!force && item.nextAttemptAt > Date.now()) {
      report.blocked = true;
      break;
    }
    try {
      await send(item);
      await removeItem(item.id);
      report.sent += 1;
    } catch (e) {
      if (e instanceof MissingFilesError) {
        const info: SyncErrorInfo = { status: 0, code: 'MISSING_FILES', message: e.message };
        await updateItem(item.id, (i) => ({ ...i, status: 'error', lastError: info }));
        report.newErrors.push({ ...item, status: 'error', lastError: info });
        continue;
      }
      const err = asApiError(e);
      if (err.status === 401) {
        report.noAuth = true;
        break;
      }
      const info: SyncErrorInfo = { status: err.status, code: err.code, message: err.message };
      if (err.isPermanent) {
        // 4xx: no reintentar solo; se muestra al usuario para que lo corrija o descarte.
        await updateItem(item.id, (i) => ({ ...i, status: 'error', lastError: info }));
        report.newErrors.push({ ...item, status: 'error', lastError: info });
        continue;
      }
      await updateItem(item.id, (i) => ({
        ...i,
        attempts: i.attempts + 1,
        nextAttemptAt: Date.now() + backoffMs(i.attempts + 1),
        lastError: info,
      }));
      report.blocked = true;
      break; // sin red o error del servidor: se respeta el orden y se reintenta después
    }
  }
  return report;
}

let inFlight: Promise<FlushReport> | null = null;

/** Sincroniza todo lo pendiente. Una sola ejecución a la vez. */
export function flushAll(force = false): Promise<FlushReport> {
  if (inFlight) return inFlight;
  busyListeners.forEach((l) => l(true));
  inFlight = doFlush(force)
    .then((report) => {
      if (report.newErrors.length) errorListeners.forEach((l) => l(report.newErrors));
      if (report.sent > 0) syncedListeners.forEach((l) => l(report));
      return report;
    })
    .catch((e) => {
      console.warn('[sync] error inesperado', e);
      return { sent: 0, newErrors: [], blocked: true, noAuth: false };
    })
    .finally(() => {
      inFlight = null;
      busyListeners.forEach((l) => l(false));
    });
  return inFlight;
}
