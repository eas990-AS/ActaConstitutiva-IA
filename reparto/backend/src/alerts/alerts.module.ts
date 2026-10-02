import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertType } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { isValidDate, looseUtcRange, operationDate } from '../common/dates';
import { LatLng } from '../common/geo';
import { LiveGateway } from '../common/live.gateway';
import { toAlert } from '../common/mappers';
import { PrismaService } from '../common/prisma.service';
import { scopeZone } from '../common/scope';

export const NO_SIGNAL_MINUTES = 10;
/** Tras atender una alerta, no se repite la misma antes de este tiempo. */
const REPEAT_AFTER_MINUTES = 30;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveGateway,
  ) {}

  /**
   * Crea la alerta salvo que ya exista una igual sin atender o atendida hace poco
   * (las de pánico siempre se crean).
   */
  async raise(type: AlertType, courierId: string, message: string, location: LatLng | null) {
    if (type !== 'PANIC') {
      const recent = await this.prisma.alert.findFirst({
        where: {
          type,
          courierId,
          OR: [
            { acknowledgedAt: null },
            { acknowledgedAt: { gte: new Date(Date.now() - REPEAT_AFTER_MINUTES * 60_000) } },
          ],
        },
      });
      if (recent) return null;
    }
    const alert = await this.prisma.alert.create({
      data: { type, courierId, message, lat: location?.lat ?? null, lng: location?.lng ?? null },
      include: { courier: true },
    });
    const dto = toAlert(alert);
    this.live.emit('alert', alert.courier.zoneId, dto);
    return dto;
  }

  /** Revisa cada minuto los recorridos abiertos sin ubicación reciente. */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkNoSignal(now = new Date()) {
    const threshold = new Date(now.getTime() - NO_SIGNAL_MINUTES * 60_000);
    const open = await this.prisma.route.findMany({
      where: { endedAt: null, startedAt: { lt: threshold } },
      include: { courier: true, points: { orderBy: { recordedAt: 'desc' }, take: 1 } },
    });
    for (const route of open) {
      const last = route.points[0];
      if (last && last.recordedAt >= threshold) continue;
      try {
        await this.raise(
          'NO_SIGNAL',
          route.courierId,
          `${route.courier.name} sin ubicación desde hace más de ${NO_SIGNAL_MINUTES} min`,
          last ? { lat: last.lat, lng: last.lng } : null,
        );
      } catch (e) {
        this.logger.error(`No se pudo crear alerta NO_SIGNAL: ${(e as Error).message}`);
      }
    }
  }
}

@Controller('alerts')
@Roles('ADMIN', 'SUPERVISOR')
class AlertsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() auth: AuthUser,
    @Query('date') date?: string,
    @Query('pending') pending?: string,
  ) {
    const day = date || operationDate();
    if (!isValidDate(day)) throw new BadRequestException('Fecha inválida');
    const zoneId = scopeZone(auth);
    const rows = await this.prisma.alert.findMany({
      where: {
        createdAt: looseUtcRange(day),
        acknowledgedAt: pending === 'true' ? null : undefined,
        courier: zoneId ? { zoneId } : undefined,
      },
      include: { courier: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.filter((a) => operationDate(a.createdAt) === day).map(toAlert);
  }

  @Post(':id/ack')
  async ack(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id }, include: { courier: true } });
    if (!alert) throw new NotFoundException('Alerta no encontrada');
    const zoneId = scopeZone(auth);
    if (zoneId && alert.courier.zoneId !== zoneId) throw new ForbiddenException('La alerta no es de tu zona');
    if (alert.acknowledgedAt) return toAlert(alert);
    return toAlert(
      await this.prisma.alert.update({
        where: { id },
        data: { acknowledgedAt: new Date() },
        include: { courier: true },
      }),
    );
  }
}

@Module({ controllers: [AlertsController], providers: [AlertsService], exports: [AlertsService] })
export class AlertsModule {}
