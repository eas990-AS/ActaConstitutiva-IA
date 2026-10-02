import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from './auth';

/**
 * Un supervisor con zona asignada solo ve su zona; ADMIN ve todo.
 * Devuelve el filtro de zona a aplicar (undefined = todas).
 */
export function scopeZone(user: AuthUser, requested?: string): string | undefined {
  if (user.role === 'SUPERVISOR' && user.zoneId) {
    if (requested && requested !== user.zoneId) {
      throw new ForbiddenException('Solo puedes consultar tu zona');
    }
    return user.zoneId;
  }
  return requested || undefined;
}
