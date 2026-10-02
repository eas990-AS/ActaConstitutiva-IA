import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { LocationPoint } from '../api/types';
import { appendPoints } from '../sync/locationQueue';
import { flushLocationsThrottled } from '../sync/flushLocations';
import { readBattery } from './battery';

export const LOCATION_TASK = 'reparto-background-location';

export function toPoint(loc: Location.LocationObject, battery: number | undefined): LocationPoint {
  const p: LocationPoint = {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    recordedAt: new Date(loc.timestamp).toISOString(),
  };
  if (typeof loc.coords.accuracy === 'number' && loc.coords.accuracy >= 0) p.accuracy = loc.coords.accuracy;
  if (typeof loc.coords.speed === 'number' && loc.coords.speed >= 0) p.speed = loc.coords.speed;
  if (battery !== undefined) p.battery = battery;
  return p;
}

/** Guarda los puntos y, como mucho cada minuto, intenta mandarlos al servidor. */
export async function handleLocations(locations: Location.LocationObject[]): Promise<void> {
  if (locations.length === 0) return;
  const battery = await readBattery();
  await appendPoints(locations.map((l) => toPoint(l, battery)));
  await flushLocationsThrottled().catch(() => undefined);
}

// Definida en el ámbito global (se importa desde index.ts) para que el SO la pueda despertar.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[ubicación] error en tarea de fondo', error.message);
    return;
  }
  if (!data || !Array.isArray(data.locations)) return;
  try {
    await handleLocations(data.locations);
  } catch (e) {
    console.warn('[ubicación] no se pudieron guardar los puntos', e);
  }
});
