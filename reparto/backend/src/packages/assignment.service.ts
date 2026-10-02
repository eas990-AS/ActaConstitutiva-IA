import { Injectable } from '@nestjs/common';
import { LatLng, pointInPolygon } from '../common/geo';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Zona que contiene el punto (la primera por nombre si se traslapan). */
  async zoneFor(location: LatLng | null): Promise<string | null> {
    if (!location) return null;
    const zones = await this.prisma.zone.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    const zone = zones.find((z) => pointInPolygon(location, z.polygon as unknown as LatLng[]));
    return zone?.id ?? null;
  }

  /** Repartidor activo de la zona con menos paquetes ese día. */
  async courierFor(zoneId: string | null, date: string): Promise<string | null> {
    if (!zoneId) return null;
    const couriers = await this.prisma.user.findMany({
      where: { zoneId, role: 'COURIER', active: true },
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    if (couriers.length === 0) return null;
    const loads = await this.prisma.package.groupBy({
      by: ['courierId'],
      where: { scheduledDate: date, courierId: { in: couriers.map((c) => c.id) } },
      _count: { _all: true },
    });
    const load = new Map(loads.map((l) => [l.courierId, l._count._all]));
    return couriers.reduce((best, c) => ((load.get(c.id) ?? 0) < (load.get(best.id) ?? 0) ? c : best)).id;
  }

  async assign(location: LatLng | null, date: string) {
    const zoneId = await this.zoneFor(location);
    const courierId = await this.courierFor(zoneId, date);
    return { zoneId, courierId };
  }
}
