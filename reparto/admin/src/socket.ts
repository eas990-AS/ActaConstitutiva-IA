import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { BASE_URL, getToken } from './api';
import type { Alert, AttemptEvent, LocationEvent, RouteEvent } from './types';

export interface LiveHandlers {
  location?: (e: LocationEvent) => void;
  route?: (e: RouteEvent) => void;
  attempt?: (e: AttemptEvent) => void;
  alert?: (e: Alert) => void;
}

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Conexión al namespace /live de Socket.IO mientras el componente está montado. */
export function useLiveSocket(handlers: LiveHandlers): SocketStatus {
  const ref = useRef(handlers);
  ref.current = handlers;
  const [status, setStatus] = useState<SocketStatus>('connecting');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const socket: Socket = io(`${BASE_URL}/live`, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));
    socket.on('location', (e: LocationEvent) => ref.current.location?.(e));
    socket.on('route', (e: RouteEvent) => ref.current.route?.(e));
    socket.on('attempt', (e: AttemptEvent) => ref.current.attempt?.(e));
    socket.on('alert', (e: Alert) => ref.current.alert?.(e));
    return () => {
      socket.disconnect();
    };
  }, []);

  return status;
}
