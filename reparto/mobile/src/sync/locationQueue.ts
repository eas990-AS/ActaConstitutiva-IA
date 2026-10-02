import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationPoint } from '../api/types';
import { LOCATION_QUEUE_MAX } from '../config';
import { Mutex } from '../utils/mutex';

const KEY = 'reparto.locationQueue.v1';
const mutex = new Mutex();

type Listener = (count: number) => void;
const listeners = new Set<Listener>();
let lastCount = 0;

function notify(count: number): void {
  lastCount = count;
  listeners.forEach((l) => l(count));
}

async function read(): Promise<LocationPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocationPoint[]) : [];
  } catch {
    return [];
  }
}

async function write(points: LocationPoint[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(points));
  notify(points.length);
}

/** Agrega puntos al final de la cola persistente. */
export function appendPoints(points: LocationPoint[]): Promise<void> {
  if (points.length === 0) return Promise.resolve();
  return mutex.run(async () => {
    let all = (await read()).concat(points);
    if (all.length > LOCATION_QUEUE_MAX) all = all.slice(all.length - LOCATION_QUEUE_MAX);
    await write(all);
  });
}

/** Devuelve (sin quitar) los primeros `max` puntos. */
export function peekPoints(max: number): Promise<LocationPoint[]> {
  return mutex.run(async () => (await read()).slice(0, max));
}

/**
 * Quita los primeros `n` puntos. Seguro aunque se hayan agregado puntos
 * mientras se enviaba el lote, porque siempre se agregan al final.
 */
export function removeFirst(n: number): Promise<void> {
  return mutex.run(async () => {
    const all = await read();
    await write(all.slice(n));
  });
}

export function clearPoints(): Promise<void> {
  return mutex.run(() => write([]));
}

export function countPoints(): Promise<number> {
  return mutex.run(async () => {
    const n = (await read()).length;
    if (n !== lastCount) notify(n);
    return n;
  });
}

export function subscribePointCount(listener: Listener): () => void {
  listeners.add(listener);
  listener(lastCount);
  return () => {
    listeners.delete(listener);
  };
}
