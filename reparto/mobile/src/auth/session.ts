import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../api/types';

const USER_KEY = 'reparto.user.v1';
/** Último usuario que inició sesión en este teléfono (no se borra al cerrar sesión). */
const LAST_USER_KEY = 'reparto.lastUserId.v1';
let currentUser: User | null = null;

/** Id del usuario con sesión iniciada (sirve también fuera de React, p. ej. en la sincronización). */
export function getCurrentUserId(): string | null {
  return currentUser?.id ?? null;
}

export async function loadStoredUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    currentUser = raw ? (JSON.parse(raw) as User) : null;
  } catch {
    currentUser = null;
  }
  return currentUser;
}

export async function storeUser(user: User | null): Promise<void> {
  currentUser = user;
  if (user) {
    await AsyncStorage.multiSet([
      [USER_KEY, JSON.stringify(user)],
      [LAST_USER_KEY, user.id],
    ]);
  } else {
    await AsyncStorage.removeItem(USER_KEY);
  }
}

export async function getLastUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}
