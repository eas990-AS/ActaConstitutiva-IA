import Constants from 'expo-constants';

function normalizeApiUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  // El contrato define la base como `/api`. Aceptamos tanto `http://host:3000`
  // como `http://host:3000/api`.
  if (!/\/api$/.test(url)) url = `${url}/api`;
  return url;
}

function readApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.trim()) return normalizeApiUrl(fromEnv);
  const extra = Constants.expoConfig?.extra as { apiUrl?: unknown } | undefined;
  if (extra && typeof extra.apiUrl === 'string' && extra.apiUrl.trim()) {
    return normalizeApiUrl(extra.apiUrl);
  }
  return normalizeApiUrl('http://localhost:3000');
}

export const API_URL = readApiUrl();

/** Distancia máxima (m) al destino sin justificación. */
export const MAX_DISTANCE_WITHOUT_JUSTIFICATION_M = 150;
/** Máximo de puntos por lote en POST /courier/locations. */
export const LOCATION_BATCH_SIZE = 500;
/** Tope de puntos guardados localmente (se descartan los más viejos). */
export const LOCATION_QUEUE_MAX = 20000;
