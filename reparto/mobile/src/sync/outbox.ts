import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FailReason, LatLng } from '../api/types';
import { Mutex } from '../utils/mutex';
import { deleteItemFiles } from './files';

const KEY = 'reparto.outbox.v1';

export interface SyncErrorInfo {
  status: number;
  code?: string;
  message: string;
}

interface BaseItem {
  /** Para entregas/fallos es el `clientId` (idempotencia). */
  id: string;
  userId: string;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
  /** `error` = el servidor lo rechazó (4xx); requiere acción del usuario. */
  status: 'pending' | 'error';
  lastError?: SyncErrorInfo;
}

export interface DeliverItem extends BaseItem {
  kind: 'deliver';
  packageId: string;
  trackingCode: string;
  data: {
    location: LatLng;
    occurredAt: string;
    recipientName?: string;
    comment?: string;
    distanceJustification?: string;
    distanceMeters?: number | null;
    photos: string[];
    signature?: string;
  };
}

export interface FailItem extends BaseItem {
  kind: 'fail';
  packageId: string;
  trackingCode: string;
  data: {
    location: LatLng;
    occurredAt: string;
    reason: FailReason;
    comment?: string;
    photo: string;
  };
}

export interface EndRouteItem extends BaseItem {
  kind: 'endRoute';
  routeId: string;
  data: { location: LatLng; endedAt: string };
}

export type OutboxItem = DeliverItem | FailItem | EndRouteItem;

type NewItem<T extends OutboxItem> = Omit<T, 'createdAt' | 'attempts' | 'nextAttemptAt' | 'status' | 'lastError'>;

type Listener = (items: OutboxItem[]) => void;

const mutex = new Mutex();
const listeners = new Set<Listener>();
let items: OutboxItem[] = [];
let loaded = false;

function emit(): void {
  const snapshot = items.slice();
  listeners.forEach((l) => l(snapshot));
}

async function persist(): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  emit();
}

export function loadOutbox(): Promise<OutboxItem[]> {
  return mutex.run(async () => {
    if (!loaded) {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        items = Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
      } catch {
        items = [];
      }
      loaded = true;
      emit();
    }
    return items.slice();
  });
}

export function getOutboxItems(): OutboxItem[] {
  return items.slice();
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  listener(items.slice());
  return () => {
    listeners.delete(listener);
  };
}

export async function enqueue<T extends OutboxItem>(item: NewItem<T>): Promise<void> {
  await loadOutbox();
  await mutex.run(async () => {
    if (items.some((i) => i.id === item.id)) return;
    const full = {
      ...item,
      createdAt: new Date().toISOString(),
      attempts: 0,
      nextAttemptAt: 0,
      status: 'pending',
    } as unknown as T;
    items = [...items, full];
    await persist();
  });
}

export async function updateItem(id: string, patch: (item: OutboxItem) => OutboxItem): Promise<void> {
  await loadOutbox();
  await mutex.run(async () => {
    items = items.map((i) => (i.id === id ? patch(i) : i));
    await persist();
  });
}

export async function removeItem(id: string): Promise<void> {
  await loadOutbox();
  await mutex.run(async () => {
    items = items.filter((i) => i.id !== id);
    await persist();
  });
  deleteItemFiles(id);
}

/** Vuelve a poner un elemento con error en la cola, sin espera. */
export function retryItem(id: string): Promise<void> {
  return updateItem(id, (i) => ({ ...i, status: 'pending', attempts: 0, nextAttemptAt: 0, lastError: undefined }));
}

export async function setDistanceJustification(id: string, text: string): Promise<void> {
  await updateItem(id, (i) =>
    i.kind === 'deliver'
      ? {
          ...i,
          data: { ...i.data, distanceJustification: text },
          status: 'pending',
          attempts: 0,
          nextAttemptAt: 0,
          lastError: undefined,
        }
      : i,
  );
}

/** Borra todo (al cerrar sesión confirmando que se pierden los pendientes). */
export async function clearOutbox(): Promise<void> {
  await loadOutbox();
  const ids = items.map((i) => i.id);
  await mutex.run(async () => {
    items = [];
    await persist();
  });
  ids.forEach(deleteItemFiles);
}
