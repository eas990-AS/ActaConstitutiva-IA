import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, getMe, login, onUnauthorized } from '../api/client';
import type { User } from '../api/types';
import { isPrivacyAccepted, acceptPrivacy } from '../state/privacy';
import { clearToken, getToken, setToken } from './tokenStore';
import { stopTracking } from '../location/tracking';
import { clearPoints } from '../sync/locationQueue';
import { getLastUserId, loadStoredUser, storeUser } from './session';

interface AuthState {
  ready: boolean;
  privacyAccepted: boolean;
  user: User | null;
  /** true si la sesión se cerró porque el servidor respondió 401. */
  sessionExpired: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  acceptPrivacyNotice: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const NOT_COURIER_MESSAGE =
  'Esta aplicación es solo para repartidores. Los administradores y supervisores deben usar el panel web.';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const signOut = useCallback(async () => {
    await clearToken();
    await storeUser(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [accepted, token, stored] = await Promise.all([isPrivacyAccepted(), getToken(), loadStoredUser()]);
      if (cancelled) return;
      setPrivacyAccepted(accepted);
      if (token && stored && stored.role === 'COURIER') setUser(stored);
      else if (token || stored) await signOut();
      setReady(true);

      // Validación en segundo plano; sin red se sigue con la sesión guardada.
      if (token && stored) {
        try {
          const me = await getMe(token);
          if (cancelled) return;
          if (me.role !== 'COURIER' || !me.active) {
            await signOut();
          } else {
            await storeUser(me);
            setUser(me);
          }
        } catch (e) {
          if (e instanceof ApiError && e.status === 401 && !cancelled) {
            setSessionExpired(true);
            await signOut();
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  useEffect(
    () =>
      onUnauthorized(() => {
        setSessionExpired(true);
        void signOut();
      }),
    [signOut],
  );

  const signIn = useCallback(async (username: string, password: string) => {
    let res;
    try {
      res = await login(username.trim(), password);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) throw new Error('Usuario o contraseña incorrectos.');
        if (e.isNetwork) throw new Error('No hay conexión con el servidor. Revisa tu internet.');
        throw new Error(e.message);
      }
      throw e;
    }
    if (res.user.role !== 'COURIER') throw new Error(NOT_COURIER_MESSAGE);
    if (!res.user.active) throw new Error('Tu usuario está desactivado. Habla con tu supervisor.');
    const lastUserId = await getLastUserId();
    if (lastUserId && lastUserId !== res.user.id) {
      // Otro repartidor usa este teléfono: no mezclar ubicaciones del anterior.
      await stopTracking();
      await clearPoints();
    }
    await setToken(res.accessToken);
    await storeUser(res.user);
    setSessionExpired(false);
    setUser(res.user);
  }, []);

  const acceptPrivacyNotice = useCallback(async () => {
    await acceptPrivacy();
    setPrivacyAccepted(true);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ready, privacyAccepted, user, sessionExpired, signIn, signOut, acceptPrivacyNotice }),
    [ready, privacyAccepted, user, sessionExpired, signIn, signOut, acceptPrivacyNotice],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
