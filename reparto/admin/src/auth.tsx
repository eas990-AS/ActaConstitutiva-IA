import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, clearSession, getStoredUser, getToken, onUnauthorized, storeSession } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (getToken() ? getStoredUser() : null));
  const [token, setToken] = useState<string | null>(() => getToken());

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setToken(null);
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
    return () => onUnauthorized(null);
  }, [logout]);

  // Refresca los datos del usuario al cargar (valida el token).
  useEffect(() => {
    if (!token) return;
    api
      .me()
      .then((u) => {
        if (u.role === 'COURIER') return logout();
        setUser(u);
        storeSession(token, u);
      })
      .catch(() => {
        /* 401 ya cierra sesión; otros errores se ignoran */
      });
  }, [token, logout]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    if (res.user.role === 'COURIER') {
      throw new ApiError(403, 'Los repartidores no tienen acceso al panel. Usa la app móvil.');
    }
    if (!res.user.active) {
      throw new ApiError(403, 'Tu usuario está desactivado.');
    }
    storeSession(res.accessToken, res.user);
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, token, isAdmin: user?.role === 'ADMIN', login, logout }),
    [user, token, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
