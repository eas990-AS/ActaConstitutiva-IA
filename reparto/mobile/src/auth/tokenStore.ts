import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'reparto.accessToken';

// AFTER_FIRST_UNLOCK permite leer el token desde la tarea en segundo plano
// (por ejemplo, con el teléfono bloqueado durante el recorrido).
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

let cached: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    cached = await SecureStore.getItemAsync(TOKEN_KEY, options);
  } catch {
    cached = null;
  }
  return cached;
}

export async function setToken(token: string): Promise<void> {
  cached = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token, options);
}

export async function clearToken(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY, options);
}
