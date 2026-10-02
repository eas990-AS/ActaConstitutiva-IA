import * as Location from 'expo-location';
import type { LatLng } from '../api/types';

export interface CurrentFix {
  location: LatLng;
  accuracy: number | null;
  /** ISO del momento de la lectura. */
  at: string;
}

function timeout<T>(ms: number): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

export async function ensureForegroundPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Location.requestForegroundPermissionsAsync();
  return res.granted;
}

/**
 * Obtiene la ubicación actual con alta precisión. Si tarda demasiado, usa la última
 * ubicación conocida (máx. 5 min de antigüedad). Lanza un Error con mensaje en español.
 */
export async function getCurrentFix(timeoutMs = 20000): Promise<CurrentFix> {
  const ok = await ensureForegroundPermission();
  if (!ok) {
    throw new Error('Se necesita permiso de ubicación. Actívalo en Ajustes > Aplicaciones > Reparto > Permisos.');
  }
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) throw new Error('El GPS está apagado. Enciende la ubicación del teléfono.');

  let pos: Location.LocationObject | null = null;
  try {
    pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeout<Location.LocationObject>(timeoutMs),
    ]);
  } catch {
    pos = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
  }
  if (!pos) throw new Error('No se pudo obtener la ubicación. Sal a un lugar despejado e intenta de nuevo.');
  return {
    location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
    accuracy: pos.coords.accuracy ?? null,
    at: new Date().toISOString(),
  };
}
