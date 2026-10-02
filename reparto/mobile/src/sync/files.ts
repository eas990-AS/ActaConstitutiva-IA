import { Directory, File, Paths } from 'expo-file-system';

function outboxRoot(): Directory {
  const dir = new Directory(Paths.document, 'outbox');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function itemDir(clientId: string): Directory {
  const dir = new Directory(outboxRoot(), clientId);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * Copia un archivo temporal (caché de cámara/manipulador) al directorio de documentos
 * de la app, para que sobreviva aunque el sistema limpie la caché o se cierre la app.
 */
export function persistFile(clientId: string, sourceUri: string, name: string): string {
  const dest = new File(itemDir(clientId), name);
  if (dest.exists) dest.delete();
  new File(sourceUri).copySync(dest);
  return dest.uri;
}

/** Escribe un PNG en base64 (firma) en el directorio del elemento. */
export function writeBase64File(clientId: string, base64: string, name: string): string {
  const dest = new File(itemDir(clientId), name);
  if (dest.exists) dest.delete();
  dest.create({ intermediates: true });
  dest.write(base64, { encoding: 'base64' });
  return dest.uri;
}

export function fileExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export function deleteItemFiles(clientId: string): void {
  try {
    const dir = new Directory(Paths.document, 'outbox', clientId);
    if (dir.exists) dir.delete();
  } catch (e) {
    console.warn('[outbox] no se pudieron borrar archivos', e);
  }
}

export function deleteFile(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // sin acción
  }
}
