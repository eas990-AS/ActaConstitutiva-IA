import { BadRequestException, Controller, Get, Header, Module, Query } from '@nestjs/common';
import { FailReason, Package } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { isValidDate, operationDate } from '../common/dates';
import { PrismaService } from '../common/prisma.service';
import { scopeZone } from '../common/scope';

interface Totals {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  returned: number;
  effectiveness: number;
}

function totals(pkgs: Pick<Package, 'status'>[]): Totals {
  const count = (s: string) => pkgs.filter((p) => p.status === s).length;
  const total = pkgs.length;
  const delivered = count('DELIVERED');
  const failed = count('FAILED');
  const returned = count('RETURNED');
  return {
    total,
    delivered,
    failed,
    returned,
    pending: total - delivered - failed - returned,
    effectiveness: total ? Math.round((delivered / total) * 1000) / 1000 : 0,
  };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Evita inyección de fórmulas al abrir en Excel.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const STATUS_ES: Record<string, string> = {
  REGISTERED: 'Registrado',
  ASSIGNED: 'Asignado',
  IN_ROUTE: 'En ruta',
  DELIVERED: 'Entregado',
  FAILED: 'No entregado',
  RETURNED: 'Devuelto',
};

const REASON_ES: Record<FailReason, string> = {
  NO_ONE_HOME: 'No había nadie',
  WRONG_ADDRESS: 'Dirección incorrecta',
  REJECTED: 'Rechazado',
  UNSAFE_AREA: 'Zona insegura',
  OTHER: 'Otro',
};

@Controller('reports')
@Roles('ADMIN', 'SUPERVISOR')
class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('daily')
  async daily(@CurrentUser() auth: AuthUser, @Query('date') date?: string, @Query('zoneId') zoneId?: string) {
    const day = this.day(date);
    const zone = scopeZone(auth, zoneId);
    const [pkgs, zones, couriers, routes, attempts] = await Promise.all([
      this.prisma.package.findMany({ where: { scheduledDate: day, zoneId: zone } }),
      this.prisma.zone.findMany(),
      this.prisma.user.findMany({ where: { role: 'COURIER' } }),
      this.prisma.route.findMany({ where: { date: day } }),
      this.prisma.deliveryAttempt.findMany({
        where: { result: 'FAILED', package: { scheduledDate: day, zoneId: zone } },
        select: { failReason: true },
      }),
    ]);

    const byZoneIds = [...new Set(pkgs.map((p) => p.zoneId))];
    const byCourierIds = [...new Set(pkgs.map((p) => p.courierId).filter((id): id is string => !!id))];
    const reasons = new Map<FailReason, number>();
    for (const a of attempts) if (a.failReason) reasons.set(a.failReason, (reasons.get(a.failReason) ?? 0) + 1);

    return {
      date: day,
      totals: totals(pkgs),
      byZone: byZoneIds.map((id) => ({
        zoneId: id,
        zoneName: zones.find((z) => z.id === id)?.name ?? 'Sin zona',
        ...totals(pkgs.filter((p) => p.zoneId === id)),
      })),
      byCourier: byCourierIds
        .map((id) => ({
          courierId: id,
          courierName: couriers.find((c) => c.id === id)?.name ?? '—',
          distanceKm:
            Math.round(routes.filter((r) => r.courierId === id).reduce((a, r) => a + r.distanceKm, 0) * 100) / 100,
          ...totals(pkgs.filter((p) => p.courierId === id)),
        }))
        .sort((a, b) => a.courierName.localeCompare(b.courierName, 'es')),
      failureReasons: [...reasons.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  @Get('daily.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async dailyCsv(@CurrentUser() auth: AuthUser, @Query('date') date?: string, @Query('zoneId') zoneId?: string) {
    const day = this.day(date);
    const zone = scopeZone(auth, zoneId);
    const pkgs = await this.prisma.package.findMany({
      where: { scheduledDate: day, zoneId: zone },
      include: {
        zone: true,
        courier: true,
        history: { orderBy: { occurredAt: 'desc' }, take: 1 },
      },
      orderBy: { trackingCode: 'asc' },
    });
    const header = [
      'Guía', 'Destinatario', 'Dirección', 'Zona', 'Repartidor', 'Estado', 'Intentos',
      'Último evento', 'Motivo', 'Recibió', 'Distancia al destino (m)', 'Comentario',
    ];
    const rows = pkgs.map((p) => {
      const last = p.history[0];
      return [
        p.trackingCode,
        p.recipientName,
        p.address,
        p.zone?.name ?? '',
        p.courier?.name ?? '',
        STATUS_ES[p.status],
        p.attempts,
        last ? last.occurredAt.toISOString() : '',
        last?.failReason ? REASON_ES[last.failReason] : '',
        last?.recipientName ?? '',
        last?.distanceMeters != null ? Math.round(last.distanceMeters) : '',
        last?.comment ?? '',
      ];
    });
    // BOM para que Excel detecte UTF-8.
    return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  private day(date?: string) {
    const day = date || operationDate();
    if (!isValidDate(day)) throw new BadRequestException('Fecha inválida');
    return day;
  }
}

@Module({ controllers: [ReportsController] })
export class ReportsModule {}
