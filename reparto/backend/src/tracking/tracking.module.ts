import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { isValidDate, operationDate } from '../common/dates';
import { distanceMeters } from '../common/geo';
import { toAttempt, toPoint, toRoute } from '../common/mappers';
import { PrismaService } from '../common/prisma.service';
import { scopeZone } from '../common/scope';
import { StorageService } from '../common/storage.service';
import { NO_SIGNAL_MINUTES } from '../alerts/alerts.module';

const MOVING_SPEED = 1; // m/s
const MOVING_WINDOW_MS = 2 * 60_000;
const MOVING_DISTANCE = 50; // m

@Controller('tracking')
@Roles('ADMIN', 'SUPERVISOR')
class TrackingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get('live')
  async live(@CurrentUser() auth: AuthUser, @Query('zoneId') zoneId?: string) {
    const date = operationDate();
    const zone = scopeZone(auth, zoneId);
    const couriers = await this.prisma.user.findMany({
      where: { role: 'COURIER', active: true, zoneId: zone },
      orderBy: { name: 'asc' },
    });
    const ids = couriers.map((c) => c.id);
    const [routes, counts] = await Promise.all([
      this.prisma.route.findMany({
        where: { courierId: { in: ids }, OR: [{ date }, { endedAt: null }] },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.package.groupBy({
        by: ['courierId', 'status'],
        where: { courierId: { in: ids }, scheduledDate: date },
        _count: { _all: true },
      }),
    ]);
    const now = Date.now();

    return Promise.all(
      couriers.map(async (c) => {
        const route = routes.find((r) => r.courierId === c.id && !r.endedAt) ?? routes.find((r) => r.courierId === c.id) ?? null;
        const recent = route
          ? await this.prisma.locationPoint.findMany({
              where: { routeId: route.id },
              orderBy: { recordedAt: 'desc' },
              take: 20,
            })
          : [];
        const last = recent[0] ?? null;
        let state: 'MOVING' | 'STOPPED' | 'NO_SIGNAL' | 'OFF' = 'OFF';
        if (route && !route.endedAt) {
          const noSignalMs = NO_SIGNAL_MINUTES * 60_000;
          const lastSeen = last ? last.recordedAt.getTime() : route.startedAt.getTime();
          if (now - lastSeen > noSignalMs) state = 'NO_SIGNAL';
          else if (!last) state = 'STOPPED';
          else {
            const window = recent.filter((p) => last.recordedAt.getTime() - p.recordedAt.getTime() <= MOVING_WINDOW_MS);
            const oldest = window[window.length - 1];
            const moved = oldest ? distanceMeters(last, oldest) : 0;
            state = (last.speed ?? 0) > MOVING_SPEED || moved > MOVING_DISTANCE ? 'MOVING' : 'STOPPED';
          }
        }
        const n = (s: string) =>
          counts.find((x) => x.courierId === c.id && x.status === s)?._count._all ?? 0;
        const delivered = n('DELIVERED');
        const failed = n('FAILED');
        const total = ['REGISTERED', 'ASSIGNED', 'IN_ROUTE', 'DELIVERED', 'FAILED', 'RETURNED'].reduce((a, s) => a + n(s), 0);
        return {
          courier: { id: c.id, name: c.name, zoneId: c.zoneId },
          route: route ? toRoute(route) : null,
          last: last ? toPoint(last) : null,
          state,
          progress: { total, delivered, failed, pending: total - delivered - failed - n('RETURNED') },
        };
      }),
    );
  }

  @Get('routes')
  async routes(
    @CurrentUser() auth: AuthUser,
    @Query('date') date?: string,
    @Query('courierId') courierId?: string,
  ) {
    if (date && !isValidDate(date)) throw new BadRequestException('Fecha inválida');
    const zone = scopeZone(auth);
    const rows = await this.prisma.route.findMany({
      where: { date, courierId: courierId || undefined, courier: zone ? { zoneId: zone } : undefined },
      orderBy: { startedAt: 'desc' },
      take: 500,
    });
    return rows.map(toRoute);
  }

  @Get('routes/:id/path')
  async path(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    const route = await this.prisma.route.findUnique({ where: { id }, include: { courier: true } });
    if (!route) throw new NotFoundException('Recorrido no encontrado');
    const zone = scopeZone(auth);
    if (zone && route.courier.zoneId !== zone) throw new ForbiddenException('El recorrido no es de tu zona');
    const [points, attempts] = await Promise.all([
      this.prisma.locationPoint.findMany({ where: { routeId: id }, orderBy: { recordedAt: 'asc' } }),
      this.prisma.deliveryAttempt.findMany({
        where: { routeId: id },
        include: { evidences: true },
        orderBy: { occurredAt: 'asc' },
      }),
    ]);
    return {
      route: toRoute(route),
      points: points.map(toPoint),
      attempts: attempts.map((a) => toAttempt(a, this.storage)),
    };
  }
}

@Module({ controllers: [TrackingController] })
export class TrackingModule {}
