import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Package, PackageStatus, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Matches, Max, Min, MinLength, ValidateNested } from 'class-validator';
import { parse } from 'csv-parse/sync';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { DATE_RE, isValidDate, operationDate } from '../common/dates';
import { LatLng } from '../common/geo';
import { toAttempt, toPackage } from '../common/mappers';
import { PrismaService } from '../common/prisma.service';
import { scopeZone } from '../common/scope';
import { StorageService } from '../common/storage.service';
import { AssignmentService } from './assignment.service';

class LatLngDto {
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
}

class CreatePackageDto {
  @IsString() @MinLength(1) trackingCode: string;
  @IsString() @MinLength(1) recipientName: string;
  @IsOptional() @IsString() recipientPhone?: string;
  @IsString() @MinLength(3) address: string;
  @IsOptional() @ValidateNested() @Type(() => LatLngDto) location?: LatLngDto;
  @IsOptional() @IsString() notes?: string;
  @Matches(DATE_RE, { message: 'scheduledDate debe ser YYYY-MM-DD' }) scheduledDate: string;
}

class AssignDto {
  @IsString() courierId: string;
}

class RescheduleDto {
  @Matches(DATE_RE, { message: 'scheduledDate debe ser YYYY-MM-DD' }) scheduledDate: string;
  @IsOptional() @IsString() courierId?: string;
}

const FINAL: PackageStatus[] = ['DELIVERED', 'RETURNED'];

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignment: AssignmentService,
  ) {}

  /** ASSIGNED o IN_ROUTE según si el repartidor ya tiene recorrido abierto ese día. */
  async statusFor(courierId: string | null, date: string): Promise<PackageStatus> {
    if (!courierId) return 'REGISTERED';
    if (date !== operationDate()) return 'ASSIGNED';
    const open = await this.prisma.route.findFirst({ where: { courierId, endedAt: null, date } });
    return open ? 'IN_ROUTE' : 'ASSIGNED';
  }

  async create(input: {
    trackingCode: string;
    recipientName: string;
    recipientPhone?: string | null;
    address: string;
    location?: LatLng | null;
    notes?: string | null;
    scheduledDate: string;
  }): Promise<Package> {
    if (!isValidDate(input.scheduledDate)) throw new BadRequestException('Fecha inválida');
    const location = input.location ?? null;
    const { zoneId, courierId } = await this.assignment.assign(location, input.scheduledDate);
    try {
      return await this.prisma.package.create({
        data: {
          trackingCode: input.trackingCode.trim(),
          recipientName: input.recipientName.trim(),
          recipientPhone: input.recipientPhone?.trim() || null,
          address: input.address.trim(),
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          notes: input.notes?.trim() || null,
          scheduledDate: input.scheduledDate,
          zoneId,
          courierId,
          status: await this.statusFor(courierId, input.scheduledDate),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`La guía ${input.trackingCode} ya existe`);
      }
      throw e;
    }
  }
}

@Controller('packages')
@Roles('ADMIN', 'SUPERVISOR')
class PackagesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packages: PackagesService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async list(
    @CurrentUser() auth: AuthUser,
    @Query('date') date?: string,
    @Query('zoneId') zoneId?: string,
    @Query('courierId') courierId?: string,
    @Query('status') status?: PackageStatus,
    @Query('q') q?: string,
  ) {
    if (date && !isValidDate(date)) throw new BadRequestException('Fecha inválida');
    if (status && !Object.values(PackageStatus).includes(status)) {
      throw new BadRequestException('Estado inválido');
    }
    const term = q?.trim();
    const rows = await this.prisma.package.findMany({
      where: {
        scheduledDate: date,
        zoneId: scopeZone(auth, zoneId),
        courierId: courierId || undefined,
        status,
        OR: term
          ? [
              { trackingCode: { contains: term, mode: 'insensitive' } },
              { recipientName: { contains: term, mode: 'insensitive' } },
              { address: { contains: term, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'asc' }],
      take: 2000,
    });
    return rows.map(toPackage);
  }

  @Post()
  async create(@Body() dto: CreatePackageDto) {
    return toPackage(await this.packages.create(dto));
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async import(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Adjunta el archivo CSV en el campo "file"');
    let records: Record<string, string>[];
    try {
      records = parse(file.buffer.toString('utf8').replace(/^﻿/, ''), {
        columns: (header: string[]) => header.map((h) => h.trim()),
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e) {
      throw new BadRequestException(`CSV inválido: ${(e as Error).message}`);
    }
    const required = ['trackingCode', 'recipientName', 'address', 'scheduledDate'];
    const header = records.length ? Object.keys(records[0]) : [];
    const missing = required.filter((c) => records.length && !header.includes(c));
    if (missing.length) throw new BadRequestException(`Faltan columnas: ${missing.join(', ')}`);

    let created = 0;
    const errors: { line: number; message: string }[] = [];
    for (const [i, r] of records.entries()) {
      const line = i + 2; // +1 encabezado, +1 base 1
      try {
        const missingValues = required.filter((c) => !r[c]);
        if (missingValues.length) throw new Error(`Faltan valores: ${missingValues.join(', ')}`);
        if (!isValidDate(r.scheduledDate)) throw new Error('scheduledDate debe ser YYYY-MM-DD');
        let location: LatLng | null = null;
        if (r.lat || r.lng) {
          const lat = Number(r.lat);
          const lng = Number(r.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            throw new Error('lat/lng inválidos');
          }
          location = { lat, lng };
        }
        await this.packages.create({
          trackingCode: r.trackingCode,
          recipientName: r.recipientName,
          recipientPhone: r.recipientPhone,
          address: r.address,
          location,
          notes: r.notes,
          scheduledDate: r.scheduledDate,
        });
        created++;
      } catch (e) {
        errors.push({ line, message: (e as Error).message });
      }
    }
    return { created, errors };
  }

  @Get(':id')
  async detail(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    const pkg = await this.find(auth, id);
    const history = await this.prisma.deliveryAttempt.findMany({
      where: { packageId: id },
      include: { evidences: true },
      orderBy: { occurredAt: 'asc' },
    });
    return { ...toPackage(pkg), history: history.map((a) => toAttempt(a, this.storage)) };
  }

  @Post(':id/assign')
  async assign(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: AssignDto) {
    const pkg = await this.find(auth, id);
    if (FINAL.includes(pkg.status)) throw new ConflictException('El paquete ya está cerrado');
    const courier = await this.courier(auth, dto.courierId);
    const status =
      pkg.status === 'FAILED' ? 'FAILED' : await this.packages.statusFor(courier.id, pkg.scheduledDate);
    const updated = await this.prisma.package.update({
      where: { id },
      data: { courierId: courier.id, zoneId: courier.zoneId ?? pkg.zoneId, status },
    });
    return toPackage(updated);
  }

  @Post(':id/reschedule')
  async reschedule(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: RescheduleDto) {
    const pkg = await this.find(auth, id);
    if (FINAL.includes(pkg.status)) throw new ConflictException('El paquete ya está cerrado');
    if (!isValidDate(dto.scheduledDate)) throw new BadRequestException('Fecha inválida');
    if (dto.scheduledDate < operationDate()) {
      throw new BadRequestException('No se puede reprogramar a una fecha pasada');
    }
    const courier = dto.courierId ? await this.courier(auth, dto.courierId) : null;
    const courierId = courier?.id ?? pkg.courierId;
    const updated = await this.prisma.package.update({
      where: { id },
      data: {
        scheduledDate: dto.scheduledDate,
        courierId,
        zoneId: courier?.zoneId ?? pkg.zoneId,
        status: await this.packages.statusFor(courierId, dto.scheduledDate),
      },
    });
    return toPackage(updated);
  }

  @Post(':id/return')
  async markReturned(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    const pkg = await this.find(auth, id);
    if (FINAL.includes(pkg.status)) throw new ConflictException('El paquete ya está cerrado');
    return toPackage(await this.prisma.package.update({ where: { id }, data: { status: 'RETURNED' } }));
  }

  private async find(auth: AuthUser, id: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Paquete no encontrado');
    if (auth.role === 'SUPERVISOR' && auth.zoneId && pkg.zoneId !== auth.zoneId) {
      throw new ForbiddenException('El paquete no es de tu zona');
    }
    return pkg;
  }

  private async courier(auth: AuthUser, courierId: string) {
    const courier = await this.prisma.user.findFirst({
      where: { id: courierId, role: 'COURIER', active: true },
    });
    if (!courier) throw new BadRequestException('Repartidor no encontrado o inactivo');
    if (auth.role === 'SUPERVISOR' && auth.zoneId && courier.zoneId !== auth.zoneId) {
      throw new ForbiddenException('El repartidor no es de tu zona');
    }
    return courier;
  }
}

@Module({
  controllers: [PackagesController],
  providers: [PackagesService, AssignmentService],
  exports: [PackagesService],
})
export class PackagesModule {}
