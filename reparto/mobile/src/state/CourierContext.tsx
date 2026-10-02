import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetInfo } from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { ApiError, getToday, sendPanic, startRoute } from '../api/client';
import type { CourierToday, FailReason, LatLng, Package, PackageStatus, Route } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { getCurrentFix } from '../location/current';
import {
  reconcileTracking,
  startTracking,
  stopTracking,
  subscribeTracking,
  type TrackingMode,
} from '../location/tracking';
import { persistFile } from '../sync/files';
import { flushAll, onBusy, onSyncErrors, onSynced } from '../sync/flush';
import { clearPoints, countPoints, subscribePointCount } from '../sync/locationQueue';
import { clearOutbox, enqueue, loadOutbox, subscribeOutbox, type DeliverItem, type EndRouteItem, type FailItem, type OutboxItem } from '../sync/outbox';
import { startSyncLoop } from '../sync/scheduler';

export interface PackageView extends Package {
  /** Estado mostrado: incluye entregas/fallos capturados que aún no se sincronizan. */
  effectiveStatus: PackageStatus;
  sync: 'pending' | 'error' | null;
}

export interface Counts {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  returned: number;
}

export interface DeliveryDraft {
  clientId: string;
  location: LatLng;
  occurredAt: string;
  recipientName?: string;
  comment?: string;
  distanceJustification?: string;
  distanceMeters: number | null;
  /** URIs temporales (caché); se copian al directorio de documentos al guardar. */
  photos: string[];
  /** URI ya persistida con writeBase64File. */
  signature?: string;
}

export interface FailureDraft {
  clientId: string;
  location: LatLng;
  occurredAt: string;
  reason: FailReason;
  comment?: string;
  photo: string;
}

interface CourierState {
  today: CourierToday | null;
  packages: PackageView[];
  counts: Counts;
  route: Route | null;
  routeOpen: boolean;
  /** Recorrido cerrado en el teléfono pero aún no confirmado por el servidor. */
  routeEndPending: boolean;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  online: boolean;
  tracking: TrackingMode;
  outbox: OutboxItem[];
  pendingCount: number;
  errorCount: number;
  pointsPending: number;
  syncing: boolean;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
  beginRoute: () => Promise<{ warning?: string }>;
  finishRoute: () => Promise<Counts>;
  submitDelivery: (pkg: Package, draft: DeliveryDraft) => Promise<void>;
  submitFailure: (pkg: Package, draft: FailureDraft) => Promise<void>;
  panic: () => Promise<void>;
  logout: () => Promise<void>;
}

const CourierContext = createContext<CourierState | null>(null);

const cacheKey = (userId: string) => `reparto.todayCache.v1.${userId}`;
const endedKey = (userId: string) => `reparto.endedRoutes.v1.${userId}`;

const OPEN_STATUSES: PackageStatus[] = ['REGISTERED', 'ASSIGNED', 'IN_ROUTE'];

export function computeCounts(pkgs: { effectiveStatus: PackageStatus }[]): Counts {
  const c: Counts = { total: pkgs.length, delivered: 0, failed: 0, pending: 0, returned: 0 };
  for (const p of pkgs) {
    if (p.effectiveStatus === 'DELIVERED') c.delivered++;
    else if (p.effectiveStatus === 'FAILED') c.failed++;
    else if (p.effectiveStatus === 'RETURNED') c.returned++;
    else if (OPEN_STATUSES.includes(p.effectiveStatus)) c.pending++;
  }
  return c;
}

export function canAct(pkg: PackageView, routeOpen: boolean): boolean {
  return routeOpen && (pkg.effectiveStatus === 'IN_ROUTE' || pkg.effectiveStatus === 'ASSIGNED');
}

export function CourierProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? '';
  const net = useNetInfo();
  const online = net.isConnected !== false && net.isInternetReachable !== false;

  const [today, setToday] = useState<CourierToday | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TrackingMode>('off');
  const [allOutbox, setAllOutbox] = useState<OutboxItem[]>([]);
  const [pointsPending, setPointsPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  /** Recorridos cerrados desde este teléfono (evita reabrirlos por datos viejos del servidor). */
  const [endedLocally, setEndedLocally] = useState<string[]>([]);
  const refreshing = useRef(false);

  const saveToday = useCallback(
    async (data: CourierToday) => {
      setToday(data);
      const now = new Date().toISOString();
      setLastUpdated(now);
      if (userId) {
        await AsyncStorage.setItem(cacheKey(userId), JSON.stringify({ data, at: now })).catch(() => undefined);
      }
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    if (!userId || refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    try {
      const data = await getToday();
      await saveToday(data);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) setError('Sin conexión. Mostrando la última información guardada.');
      else if (e instanceof ApiError && e.status === 401) setError(null);
      else setError(e instanceof Error ? e.message : 'No se pudo cargar la información.');
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, [userId, saveToday]);

  // Carga inicial: caché local + servidor.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      await loadOutbox();
      await countPoints();
      try {
        const ended = await AsyncStorage.getItem(endedKey(userId));
        if (ended && !cancelled) setEndedLocally(JSON.parse(ended) as string[]);
      } catch {
        // sin acción
      }
      try {
        const raw = await AsyncStorage.getItem(cacheKey(userId));
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as { data: CourierToday; at: string };
          setToday(parsed.data);
          setLastUpdated(parsed.at);
        }
      } catch {
        // caché corrupta: se ignora
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  // Suscripciones a sincronización y rastreo.
  useEffect(() => {
    if (!userId) return;
    const subs = [
      subscribeOutbox(setAllOutbox),
      subscribePointCount(setPointsPending),
      subscribeTracking(setTracking),
      onBusy(setSyncing),
      onSynced(() => void refresh()),
      onSyncErrors((items) => {
        const first = items[0];
        const msg =
          first?.lastError?.code === 'DISTANCE_JUSTIFICATION_REQUIRED'
            ? 'El servidor pide justificar por qué la entrega se registró lejos del domicilio.'
            : first?.lastError?.message ?? 'El servidor rechazó un registro.';
        Alert.alert('No se pudo sincronizar', `${msg}\n\nRevisa la pantalla de Sincronización.`, [
          { text: 'Después', style: 'cancel' },
          { text: 'Ver', onPress: () => router.push('/sync') },
        ]);
      }),
    ];
    const stopLoop = startSyncLoop();
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => {
      subs.forEach((u) => u());
      stopLoop();
      appSub.remove();
    };
  }, [userId, refresh]);

  const outbox = useMemo(() => allOutbox.filter((i) => i.userId === userId), [allOutbox, userId]);

  const route = today?.route ?? null;
  const routeEndPending = !!route && outbox.some((i) => i.kind === 'endRoute' && i.routeId === route.id);
  const routeOpen = !!route && !route.endedAt && !routeEndPending && !endedLocally.includes(route.id);
  const openRouteId = routeOpen && route ? route.id : null;

  // Mantener el rastreo alineado con el recorrido (p. ej. al reabrir la app o tras reiniciar).
  const reconciled = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!userId || today === null) return;
    if (reconciled.current === openRouteId) return;
    reconciled.current = openRouteId;
    void reconcileTracking(openRouteId).then((res) => {
      if (res?.warning) Alert.alert('Ubicación', res.warning);
    });
  }, [userId, today, openRouteId]);

  const packages = useMemo<PackageView[]>(() => {
    const byPkg = new Map<string, OutboxItem>();
    for (const i of outbox) if (i.kind !== 'endRoute') byPkg.set(i.packageId, i);
    return (today?.packages ?? []).map((p) => {
      const item = byPkg.get(p.id);
      if (!item || item.kind === 'endRoute') return { ...p, effectiveStatus: p.status, sync: null };
      return {
        ...p,
        effectiveStatus: item.kind === 'deliver' ? 'DELIVERED' : 'FAILED',
        sync: item.status === 'error' ? 'error' : 'pending',
      };
    });
  }, [today, outbox]);

  const counts = useMemo(() => computeCounts(packages), [packages]);

  const syncNow = useCallback(async () => {
    await flushAll(true);
    await refresh();
  }, [refresh]);

  const beginRoute = useCallback(async (): Promise<{ warning?: string }> => {
    const fix = await getCurrentFix();
    let newRoute: Route;
    try {
      newRoute = await startRoute(fix.location, fix.at);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.isNetwork) throw new Error('Se necesita conexión a internet para iniciar el recorrido.');
        if (e.status === 409) {
          // Ya había un recorrido abierto: se toma el del servidor.
          await refresh();
          return {};
        }
        throw new Error(e.message);
      }
      throw e;
    }
    if (today) await saveToday({ ...today, route: newRoute });
    reconciled.current = newRoute.id;
    const res = await startTracking(newRoute.id);
    void refresh();
    return { warning: res.warning };
  }, [today, refresh, saveToday]);

  const finishRoute = useCallback(async (): Promise<Counts> => {
    if (!route) throw new Error('No hay un recorrido abierto.');
    let location: LatLng | null = null;
    try {
      location = (await getCurrentFix(15000)).location;
    } catch {
      location = route.startLocation;
    }
    if (!location) throw new Error('No se pudo obtener tu ubicación para cerrar el recorrido. Intenta de nuevo.');
    const summary = counts;
    reconciled.current = null;
    const ended = [...endedLocally.slice(-20), route.id];
    setEndedLocally(ended);
    await AsyncStorage.setItem(endedKey(userId), JSON.stringify(ended)).catch(() => undefined);
    await stopTracking();
    const item: Omit<EndRouteItem, 'createdAt' | 'attempts' | 'nextAttemptAt' | 'status' | 'lastError'> = {
      kind: 'endRoute',
      id: Crypto.randomUUID(),
      userId,
      routeId: route.id,
      data: { location, endedAt: new Date().toISOString() },
    };
    await enqueue<EndRouteItem>(item);
    void flushAll(true);
    return summary;
  }, [route, counts, userId, endedLocally]);

  const submitDelivery = useCallback(
    async (pkg: Package, d: DeliveryDraft) => {
      const photos = d.photos.map((uri, i) => persistFile(d.clientId, uri, `foto-${i + 1}.jpg`));
      await enqueue<DeliverItem>({
        kind: 'deliver',
        id: d.clientId,
        userId,
        packageId: pkg.id,
        trackingCode: pkg.trackingCode,
        data: {
          location: d.location,
          occurredAt: d.occurredAt,
          recipientName: d.recipientName,
          comment: d.comment,
          distanceJustification: d.distanceJustification,
          distanceMeters: d.distanceMeters,
          photos,
          signature: d.signature,
        },
      });
      void flushAll(true);
    },
    [userId],
  );

  const submitFailure = useCallback(
    async (pkg: Package, d: FailureDraft) => {
      const photo = persistFile(d.clientId, d.photo, 'fachada.jpg');
      await enqueue<FailItem>({
        kind: 'fail',
        id: d.clientId,
        userId,
        packageId: pkg.id,
        trackingCode: pkg.trackingCode,
        data: { location: d.location, occurredAt: d.occurredAt, reason: d.reason, comment: d.comment, photo },
      });
      void flushAll(true);
    },
    [userId],
  );

  const panic = useCallback(async () => {
    const fix = await getCurrentFix(10000);
    try {
      await sendPanic(fix.location);
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) {
        throw new Error('No hay conexión: la alerta NO se envió. Si estás en peligro llama al 911.');
      }
      throw new Error(e instanceof Error ? e.message : 'No se pudo enviar la alerta.');
    }
  }, []);

  const logout = useCallback(async () => {
    await stopTracking();
    await clearPoints();
    await clearOutbox();
    if (userId) await AsyncStorage.multiRemove([cacheKey(userId), endedKey(userId)]).catch(() => undefined);
    setEndedLocally([]);
    reconciled.current = undefined;
    setToday(null);
    await signOut();
  }, [signOut, userId]);

  const value = useMemo<CourierState>(
    () => ({
      today,
      packages,
      counts,
      route,
      routeOpen,
      routeEndPending,
      loading,
      error,
      lastUpdated,
      online,
      tracking,
      outbox,
      pendingCount: outbox.filter((i) => i.status === 'pending').length,
      errorCount: outbox.filter((i) => i.status === 'error').length,
      pointsPending,
      syncing,
      refresh,
      syncNow,
      beginRoute,
      finishRoute,
      submitDelivery,
      submitFailure,
      panic,
      logout,
    }),
    [
      today,
      packages,
      counts,
      route,
      routeOpen,
      routeEndPending,
      loading,
      error,
      lastUpdated,
      online,
      tracking,
      outbox,
      pointsPending,
      syncing,
      refresh,
      syncNow,
      beginRoute,
      finishRoute,
      submitDelivery,
      submitFailure,
      panic,
      logout,
    ],
  );

  return <CourierContext.Provider value={value}>{children}</CourierContext.Provider>;
}

export function useCourier(): CourierState {
  const ctx = useContext(CourierContext);
  if (!ctx) throw new Error('useCourier fuera de CourierProvider');
  return ctx;
}
