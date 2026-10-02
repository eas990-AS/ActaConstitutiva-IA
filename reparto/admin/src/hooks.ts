import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';
import type { User, Zone } from './types';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (fn: (prev: T | undefined) => T | undefined) => void;
}

/** Ejecuta una función asíncrona cuando cambian las dependencias. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((d) => {
        if (!cancelled) setDataState(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((f: (prev: T | undefined) => T | undefined) => setDataState(f), []);
  return { data, loading, error, reload, setData };
}

/** Catálogos usados en filtros: zonas y repartidores. */
export function useLookups() {
  const zones = useAsync<Zone[]>(() => api.zones(), []);
  const couriers = useAsync<User[]>(() => api.users({ role: 'COURIER' }), []);
  const zoneName = (id: string | null | undefined) =>
    (id && zones.data?.find((z) => z.id === id)?.name) || (id ? '—' : 'Sin zona');
  const courierName = (id: string | null | undefined) =>
    (id && couriers.data?.find((c) => c.id === id)?.name) || (id ? '—' : 'Sin asignar');
  return { zones, couriers, zoneName, courierName };
}
