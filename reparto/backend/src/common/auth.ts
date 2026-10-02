import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from './prisma.service';

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  zoneId: string | null;
}

const PUBLIC_KEY = 'isPublic';
const ROLES_KEY = 'roles';

/** Ruta sin autenticación. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Roles permitidos (si se omite, cualquier usuario autenticado). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);

/** Valida el token y que el usuario siga activo; luego aplica @Roles. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Falta el token de acceso');

    const user = await verifyToken(this.jwt, this.prisma, token);
    if (!user) throw new UnauthorizedException('Sesión inválida o vencida');
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return true;
  }
}

export async function verifyToken(
  jwt: JwtService,
  prisma: PrismaService,
  token: string,
): Promise<AuthUser | null> {
  try {
    const payload = await jwt.verifyAsync<{ sub: string }>(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) return null;
    return { id: user.id, role: user.role, name: user.name, zoneId: user.zoneId };
  } catch {
    return null;
  }
}
