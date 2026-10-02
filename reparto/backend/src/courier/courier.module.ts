import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpException,
  Module,
  NotFoundException,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { EvidenceKind, FailReason, Prisma, Route } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AlertsModule, AlertsService } from '../alerts/alerts.module';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { operationDate } from '../common/dates';
import { distanceMeters, LatLng, nearestNeighborOrder, pathDistanceKm, pointInPolygon } from '../common/geo';
import { LiveGateway } from '../common/live.gateway';
import { toAttempt, toPackage, toRoute, toZone } from '../common/mappers';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';

export const MAX_DISTANCE_METERS = 150;
const LOW_BATTERY = 0.15;
/** Puntos con peor precisión no cuentan para los km recorridos. */
const MAX_ACCURACY_FOR_DISTANCE = 100;
const CLOCK_SKEW_MS = 5 * 60_000;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png' };

class LatLngDto {
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
}

class RouteEventDto {
  @ValidateNested() @Type(() => LatLngDto) location: LatLngDto;
  @IsOptional() @IsDateString() startedAt?: string;
  @IsOptional() @IsDateString() endedAt?: string;
}

class PointDto {
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
  @IsOptional() @IsNumber() accuracy?: number;
  @IsOptional() @IsNumber() speed?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) battery?: number;
  @IsDateString() recordedAt: string;
}

class LocationsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => PointDto)
  points: PointDto[];
}

class PanicDto {
  @ValidateNested() @Type(() => LatLngDto) location: LatLngDto;
}

type Files = { photos?: Express.Multer.File[]; signature?: Express.Multer.File[] };
type Fields = Record<string, string | undefined>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseFields(body: Fields) {
  if (!body.clientId || !UUID_RE.test(body.clientId)) {
    throw new BadRequestException('clientId debe ser un UUID');
  }
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const hasLocation = body.lat !== undefined && body.lat !== '' && body.lng !== undefined && body.lng !== '';
  if (hasLocation && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
    throw new BadRequestException('lat/lng inválidos');
  }
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new BadRequestException('occurredAt inválido');
  if (occurredAt.getTime() > Date.now() + CLOCK_SKEW_MS) {
    throw new BadRequestException('occurredAt está en el futuro');
  }
  const text = (v?: string) => (v && v.trim() ? v.trim() : null);
  return {
    clientId: body.clientId,
    location: hasLocation ? { lat, lng } : null,
    occurredAt,
    recipientName: text(body.recipientName),
    comment: text(body.comment),
    distanceJustification: text(body.distanceJustification),
    reason: body.reason,
  };
}

function checkImages(files: Express.Multer.File[] | undefined, min: number, max: number, label: string) {
  const list = files ?? [];
  if (list.length < min || list.length > max) {
    throw new BadRequestException(
      min === max ? `Se requiere ${min} ${label}` : `Se requieren de ${min} a ${max} ${label}`,
    );
  }
  for (const f of list) {
    if (!IMAGE_TYPES[f.mimetype]) throw new BadRequestException('Las fotos deben ser JPEG o PNG');
  }
  return list;
}

@Controller('courier')
@Roles('COURIER')
class CourierController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly live: LiveGateway,
    private readonly alerts: AlertsService,
  ) {}

  @Get('today')
  async today(@CurrentUser() auth: AuthUser) {
    const date = operationDate();
    const [route, zone, packages] = await Promise.all([
      this.prisma.route.findFirst({ where: { courierId: auth.id, date }, orderBy: { startedAt: 'desc' } }),
      auth.zoneId ? this.prisma.zone.findUnique({ where: { id: auth.zoneId } }) : null,
      this.prisma.package.findMany({
        where: { courierId: auth.id, scheduledDate: date },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const start = route?.startLat != null && route.startLng != null ? { lat: route.startLat, lng: route.startLng } : null;
    const ordered = nearestNeighborOrder(
      packages,
      (p) => (p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null),
      start,
    );
    return {
      route: route ? toRoute(route) : null,
      zone: zone && zone.active ? toZone(zone) : null,
      packages: ordered.map(toPackage),
    };
  }

  @Post('routes/start')
  async start(@CurrentUser() auth: AuthUser, @Body() dto: RouteEventDto) {
    const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date();
    const date = operationDate(startedAt);
    const open = await this.prisma.route.findFirst({ where: { courierId: auth.id, endedAt: null } });
    if (open && open.date === date) return toRoute(open); // reintento: idempotente
    if (open) await this.close(open, open.startedAt, null); // quedó abierto de otro día

    const route = await this.prisma.route.create({
      data: {
        courierId: auth.id,
        date,
        startedAt,
        startLat: dto.location.lat,
        startLng: dto.location.lng,
      },
    });
    await this.prisma.package.updateMany({
      where: { courierId: auth.id, scheduledDate: date, status: 'ASSIGNED' },
      data: { status: 'IN_ROUTE' },
    });
    const dtoRoute = toRoute(route);
    this.live.emit('route', auth.zoneId, { courierId: auth.id, route: dtoRoute, event: 'start' });
    return dtoRoute;
  }

  @Post('routes/:id/end')
  async end(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: RouteEventDto) {
    const route = await this.prisma.route.findFirst({ where: { id, courierId: auth.id } });
    if (!route) throw new NotFoundException('Recorrido no encontrado');
    const closed = route.endedAt
      ? route
      : await this.close(route, dto.endedAt ? new Date(dto.endedAt) : new Date(), dto.location);
    const counts = await this.prisma.package.groupBy({
      by: ['status'],
      where: { courierId: auth.id, scheduledDate: route.date },
      _count: { _all: true },
    });
    const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
    const dtoRoute = toRoute(closed);
    if (!route.endedAt) {
      this.live.emit('route', auth.zoneId, { courierId: auth.id, route: dtoRoute, event: 'end' });
    }
    return {
      ...dtoRoute,
      summary: {
        delivered: n('DELIVERED'),
        failed: n('FAILED'),
        pending: n('ASSIGNED') + n('IN_ROUTE') + n('REGISTERED'),
      },
    };
  }

  @Post('locations')
  async locations(@CurrentUser() auth: AuthUser, @Body() dto: LocationsDto) {
    const route = await this.prisma.route.findFirst({ where: { courierId: auth.id, endedAt: null } });
    if (!route) throw new ConflictException('No hay recorrido abierto');

    const points = dto.points
      .map((p) => ({ ...p, at: new Date(p.recordedAt) }))
      // Tolerancia por diferencia de reloj entre teléfono y servidor.
      .filter(
        (p) =>
          p.at.getTime() >= route.startedAt.getTime() - CLOCK_SKEW_MS &&
          p.at.getTime() <= Date.now() + CLOCK_SKEW_MS,
      )
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    if (points.length === 0) return { accepted: 0 };

    const lastBefore = await this.prisma.locationPoint.findFirst({
      where: { routeId: route.id },
      orderBy: { recordedAt: 'desc' },
    });
    await this.prisma.locationPoint.createMany({
      data: points.map((p) => ({
        routeId: route.id,
        lat: p.lat,
        lng: p.lng,
        accuracy: p.accuracy ?? null,
        speed: p.speed ?? null,
        battery: p.battery ?? null,
        recordedAt: p.at,
      })),
    });

    // Km recorridos: incremental si llegan en orden, recálculo completo si no.
    const inOrder = !lastBefore || lastBefore.recordedAt <= points[0].at;
    const distanceKm = inOrder
      ? route.distanceKm + pathDistanceKm(this.forDistance([...(lastBefore ? [lastBefore] : []), ...points]))
      : await this.fullDistance(route.id);
    await this.prisma.route.update({ where: { id: route.id }, data: { distanceKm } });

    const latest = points[points.length - 1];
    if (!lastBefore || latest.at >= lastBefore.recordedAt) {
      this.live.emit('location', auth.zoneId, {
        courierId: auth.id,
        point: {
          lat: latest.lat,
          lng: latest.lng,
          accuracy: latest.accuracy,
          speed: latest.speed,
          battery: latest.battery,
          recordedAt: latest.at.toISOString(),
        },
      });
      await this.checkAlerts(auth, latest);
    }
    return { accepted: points.length };
  }

  @Post('packages/:id/deliver')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'photos', maxCount: 3 }, { name: 'signature', maxCount: 1 }], {
      limits: { fileSize: MAX_PHOTO_BYTES },
    }),
  )
  async deliver(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() body: Fields,
    @UploadedFiles() files: Files = {},
  ) {
    const f = parseFields(body);
    const existing = await this.existingAttempt(auth, id, f.clientId);
    if (existing) return existing;

    const photos = checkImages(files.photos, 1, 3, 'fotos del paquete entregado');
    const signature = files.signature ? checkImages(files.signature, 1, 1, 'firma') : [];
    const pkg = await this.deliverablePackage(auth, id);
    const distance =
      f.location && pkg.lat != null && pkg.lng != null
        ? distanceMeters(f.location, { lat: pkg.lat, lng: pkg.lng })
        : null;
    if (distance !== null && distance > MAX_DISTANCE_METERS && !f.distanceJustification) {
      throw new HttpException(
        {
          statusCode: 422,
          code: 'DISTANCE_JUSTIFICATION_REQUIRED',
          message: `Estás a ${Math.round(distance)} m de la dirección; explica por qué entregas aquí`,
        },
        422,
      );
    }
    return this.recordAttempt(auth, pkg, f, distance, 'DELIVERED', null, [
      ...photos.map((file) => ({ file, kind: EvidenceKind.PACKAGE_PHOTO })),
      ...signature.map((file) => ({ file, kind: EvidenceKind.SIGNATURE })),
    ]);
  }

  @Post('packages/:id/fail')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'photos', maxCount: 1 }], { limits: { fileSize: MAX_PHOTO_BYTES } }),
  )
  async fail(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() body: Fields,
    @UploadedFiles() files: Files = {},
  ) {
    const f = parseFields(body);
    const existing = await this.existingAttempt(auth, id, f.clientId);
    if (existing) return existing;

    if (!f.reason || !Object.values(FailReason).includes(f.reason as FailReason)) {
      throw new BadRequestException('Motivo inválido');
    }
    if (f.reason === 'OTHER' && !f.comment) {
      throw new BadRequestException('Describe el motivo en el comentario');
    }
    const photos = checkImages(files.photos, 1, 1, 'foto de la fachada');
    const pkg = await this.deliverablePackage(auth, id);
    const distance =
      f.location && pkg.lat != null && pkg.lng != null
        ? distanceMeters(f.location, { lat: pkg.lat, lng: pkg.lng })
        : null;
    return this.recordAttempt(auth, pkg, f, distance, 'FAILED', f.reason as FailReason, [
      { file: photos[0], kind: EvidenceKind.FACADE_PHOTO },
    ]);
  }

  @Post('panic')
  async panic(@CurrentUser() auth: AuthUser, @Body() dto: PanicDto) {
    return this.alerts.raise('PANIC', auth.id, `${auth.name} presionó el botón de emergencia`, dto.location);
  }

  // ---------------------------------------------------------------------------

  private async close(route: Route, endedAt: Date, location: LatLng | null) {
    const last = await this.prisma.locationPoint.findFirst({
      where: { routeId: route.id },
      orderBy: { recordedAt: 'desc' },
    });
    const end = location ?? (last ? { lat: last.lat, lng: last.lng } : null);
    const closed = await this.prisma.route.update({
      where: { id: route.id },
      data: {
        endedAt: endedAt < route.startedAt ? route.startedAt : endedAt,
        endLat: end?.lat ?? null,
        endLng: end?.lng ?? null,
        distanceKm: await this.fullDistance(route.id),
      },
    });
    // Lo no intentado queda pendiente (vuelve a ASSIGNED) para reprogramarse.
    await this.prisma.package.updateMany({
      where: { courierId: route.courierId, scheduledDate: route.date, status: 'IN_ROUTE' },
      data: { status: 'ASSIGNED' },
    });
    return closed;
  }

  private forDistance<T extends { accuracy?: number | null }>(points: T[]): T[] {
    return points.filter((p) => p.accuracy == null || p.accuracy <= MAX_ACCURACY_FOR_DISTANCE);
  }

  private async fullDistance(routeId: string) {
    const all = await this.prisma.locationPoint.findMany({
      where: { routeId },
      orderBy: { recordedAt: 'asc' },
      select: { lat: true, lng: true, accuracy: true },
    });
    return pathDistanceKm(this.forDistance(all));
  }

  private async checkAlerts(auth: AuthUser, p: PointDto) {
    const location = { lat: p.lat, lng: p.lng };
    if (p.battery != null && p.battery < LOW_BATTERY) {
      await this.alerts.raise(
        'LOW_BATTERY',
        auth.id,
        `${auth.name} tiene ${Math.round(p.battery * 100)} % de batería`,
        location,
      );
    }
    if (auth.zoneId) {
      const zone = await this.prisma.zone.findUnique({ where: { id: auth.zoneId } });
      if (zone?.active && !pointInPolygon(location, zone.polygon as unknown as LatLng[])) {
        await this.alerts.raise('OUT_OF_ZONE', auth.id, `${auth.name} salió de la zona ${zone.name}`, location);
      }
    }
  }

  private async existingAttempt(auth: AuthUser, packageId: string, clientId: string) {
    const attempt = await this.prisma.deliveryAttempt.findUnique({
      where: { clientId },
      include: { evidences: true },
    });
    if (!attempt) return null;
    if (attempt.packageId !== packageId || attempt.courierId !== auth.id) {
      throw new ConflictException('clientId ya usado en otro registro');
    }
    return toAttempt(attempt, this.storage);
  }

  private async deliverablePackage(auth: AuthUser, id: string) {
    const pkg = await this.prisma.package.findFirst({ where: { id, courierId: auth.id } });
    if (!pkg) throw new NotFoundException('Paquete no encontrado en tu lista');
    if (pkg.status === 'DELIVERED' || pkg.status === 'RETURNED') {
      throw new ConflictException('El paquete ya fue cerrado');
    }
    return pkg;
  }

  private async recordAttempt(
    auth: AuthUser,
    pkg: { id: string; zoneId: string | null; scheduledDate: string },
    f: ReturnType<typeof parseFields>,
    distance: number | null,
    result: 'DELIVERED' | 'FAILED',
    failReason: FailReason | null,
    evidences: { file: Express.Multer.File; kind: EvidenceKind }[],
  ) {
    // El recorrido que cubría la hora del evento (permite sincronizar después de cerrar).
    const route = await this.prisma.route.findFirst({
      where: { courierId: auth.id, startedAt: { lte: f.occurredAt } },
      orderBy: { startedAt: 'desc' },
    });
    const stored = await Promise.all(
      evidences.map(async ({ file, kind }) => ({
        kind,
        mimeType: file.mimetype,
        ...(await this.storage.save(file.buffer, IMAGE_TYPES[file.mimetype])),
      })),
    );
    try {
      const [attempt, updated] = await this.prisma.$transaction([
        this.prisma.deliveryAttempt.create({
          data: {
            clientId: f.clientId,
            packageId: pkg.id,
            routeId: route?.id ?? null,
            courierId: auth.id,
            result,
            failReason,
            recipientName: f.recipientName,
            comment: f.comment,
            distanceJustification: f.distanceJustification,
            lat: f.location?.lat ?? null,
            lng: f.location?.lng ?? null,
            distanceMeters: distance,
            occurredAt: f.occurredAt,
            evidences: {
              create: stored.map((s) => ({
                kind: s.kind,
                storageKey: s.key,
                mimeType: s.mimeType,
                sha256: s.sha256,
              })),
            },
          },
          include: { evidences: true },
        }),
        this.prisma.package.update({
          where: { id: pkg.id },
          data: { status: result, attempts: { increment: 1 } },
        }),
      ]);
      const dto = toAttempt(attempt, this.storage);
      this.live.emit('attempt', pkg.zoneId, { courierId: auth.id, attempt: dto, package: toPackage(updated) });
      return dto;
    } catch (e) {
      // Dos envíos simultáneos con el mismo clientId: devolver el que ganó.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = await this.existingAttempt(auth, pkg.id, f.clientId);
        if (again) return again;
      }
      throw e;
    }
  }
}

@Module({ imports: [AlertsModule], controllers: [CourierController] })
export class CourierModule {}

