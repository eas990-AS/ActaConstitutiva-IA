import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { flushAll } from './flush';

function isOnline(s: NetInfoState): boolean {
  return s.isConnected === true && s.isInternetReachable !== false;
}

/**
 * Dispara la sincronización: al recuperar conexión, al volver la app al frente y
 * periódicamente (respetando la espera entre reintentos). Regresa la función para detenerlo.
 */
export function startSyncLoop(intervalMs = 30_000): () => void {
  let wasOnline: boolean | null = null;
  const unsubNet = NetInfo.addEventListener((state) => {
    const online = isOnline(state);
    if (online && wasOnline === false) void flushAll(true);
    wasOnline = online;
  });
  const appSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') void flushAll(true);
  });
  const timer = setInterval(() => void flushAll(false), intervalMs);
  void flushAll(true);
  return () => {
    unsubNet();
    appSub.remove();
    clearInterval(timer);
  };
}
