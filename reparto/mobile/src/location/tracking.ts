import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { colors } from '../theme';
import { LOCATION_TASK, handleLocations } from './task';
import { ensureForegroundPermission } from './current';

/**
 * - `background`: tarea del sistema (sigue con la app cerrada o el teléfono bloqueado).
 * - `foreground`: respaldo con watchPositionAsync (p. ej. en Expo Go), solo con la app abierta.
 * - `off`: sin rastreo.
 */
export type TrackingMode = 'background' | 'foreground' | 'off';

const ROUTE_KEY = 'reparto.trackingRouteId.v1';

type Listener = (mode: TrackingMode) => void;
const listeners = new Set<Listener>();
let mode: TrackingMode = 'off';
let watchSub: Location.LocationSubscription | null = null;

function setMode(m: TrackingMode): void {
  mode = m;
  listeners.forEach((l) => l(m));
}

export function getTrackingMode(): TrackingMode {
  return mode;
}

export function subscribeTracking(listener: Listener): () => void {
  listeners.add(listener);
  listener(mode);
  return () => {
    listeners.delete(listener);
  };
}

const OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 25,
  timeInterval: 15_000,
  // iOS
  activityType: Location.ActivityType.AutomotiveNavigation,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  // Android: servicio en primer plano con notificación persistente
  foregroundService: {
    notificationTitle: 'Recorrido activo',
    notificationBody: 'Compartiendo tu ubicación hasta que termines el recorrido.',
    notificationColor: colors.primary,
    killServiceOnDestroy: false,
  },
};

async function isBackgroundRunning(): Promise<boolean> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
    if (!registered) return false;
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

export interface StartTrackingResult {
  mode: TrackingMode;
  /** Aviso para el usuario (p. ej. permiso de segundo plano denegado). */
  warning?: string;
}

/** Inicia el rastreo para el recorrido `routeId`. Nunca lanza: regresa el modo logrado. */
export async function startTracking(routeId: string): Promise<StartTrackingResult> {
  await AsyncStorage.setItem(ROUTE_KEY, routeId);
  if (await isBackgroundRunning()) {
    setMode('background');
    return { mode: 'background' };
  }
  const fg = await ensureForegroundPermission();
  if (!fg) {
    setMode('off');
    return { mode: 'off', warning: 'Sin permiso de ubicación no se puede registrar tu recorrido.' };
  }

  let warning: string | undefined;
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) {
      warning =
        'No diste permiso de ubicación "Permitir todo el tiempo". La ubicación podría dejar de enviarse con la pantalla apagada.';
    }
  } catch {
    // Algunas plataformas (Expo Go) no permiten pedirlo.
  }

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, OPTIONS);
    setMode('background');
    return { mode: 'background', warning };
  } catch (e) {
    console.warn('[ubicación] no se pudo iniciar en segundo plano, se usa primer plano', e);
  }

  // Respaldo: solo mientras la app esté abierta (por ejemplo en Expo Go).
  try {
    watchSub?.remove();
    watchSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 25, timeInterval: 15_000 },
      (loc) => {
        void handleLocations([loc]);
      },
    );
    setMode('foreground');
    return {
      mode: 'foreground',
      warning:
        'El rastreo en segundo plano no está disponible en esta versión de la app. Mantén la app abierta durante el recorrido.',
    };
  } catch {
    setMode('off');
    return { mode: 'off', warning: 'No se pudo iniciar el rastreo de ubicación.' };
  }
}

export async function stopTracking(): Promise<void> {
  await AsyncStorage.removeItem(ROUTE_KEY);
  watchSub?.remove();
  watchSub = null;
  if (await isBackgroundRunning()) {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    } catch (e) {
      console.warn('[ubicación] error al detener', e);
    }
  }
  setMode('off');
}

/**
 * Sincroniza el rastreo con el estado del recorrido: si hay recorrido abierto y no se está
 * rastreando (p. ej. tras reiniciar el teléfono), lo reanuda; si no hay, lo detiene.
 */
export async function reconcileTracking(openRouteId: string | null): Promise<StartTrackingResult | null> {
  const running = (await isBackgroundRunning()) || watchSub !== null;
  if (openRouteId) {
    if (running) {
      setMode(watchSub ? 'foreground' : 'background');
      return null;
    }
    return startTracking(openRouteId);
  }
  if (running) await stopTracking();
  else setMode('off');
  return null;
}
