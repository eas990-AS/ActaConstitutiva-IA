import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { isValidPolygon, LatLng } from '../common/geo';
import { toZone } from '../common/mappers';
import { PrismaService } from '../common/prisma.service';
import { scopeZone } from '../common/scope';

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

class CreateZoneDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @Matches(COLOR_RE, { message: 'Color en formato #RRGGBB' }) color?: string;
  @IsArray() polygon: LatLng[];
}

class UpdateZoneDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @Matches(COLOR_RE, { message: 'Color en formato #RRGGBB' }) color?: string;
  @IsOptional() @IsArray() polygon?: LatLng[];
}

function cleanPolygon(polygon: LatLng[]): LatLng[] {
  if (!isValidPolygon(polygon)) {
    throw new BadRequestException('El polígono necesita al menos 3 vértices {lat, lng} válidos');
  }
  return polygon.map(({ lat, lng }) => ({ lat, lng }));
}

@Controller('zones')
class ZonesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('ADMIN', 'SUPERVISOR')
  async list(@CurrentUser() auth: AuthUser) {
    const zones = await this.prisma.zone.findMany({
      where: { active: true, id: scopeZone(auth) },
      orderBy: { name: 'asc' },
    });
    return zones.map(toZone);
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateZoneDto) {
    const zone = await this.prisma.zone.create({
      data: {
        name: dto.name.trim(),
        color: dto.color ?? '#2563eb',
        polygon: cleanPolygon(dto.polygon) as object[],
      },
    });
    return toZone(zone);
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    await this.find(id);
    const zone = await this.prisma.zone.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        color: dto.color,
        polygon: dto.polygon ? (cleanPolygon(dto.polygon) as object[]) : undefined,
      },
    });
    return toZone(zone);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
    await this.find(id);
    await this.prisma.$transaction([
      this.prisma.zone.update({ where: { id }, data: { active: false } }),
      this.prisma.user.updateMany({ where: { zoneId: id }, data: { zoneId: null } }),
    ]);
  }

  private async find(id: string) {
    const zone = await this.prisma.zone.findFirst({ where: { id, active: true } });
    if (!zone) throw new NotFoundException('Zona no encontrada');
    return zone;
  }
}

@Module({ controllers: [ZonesController] })
export class ZonesModule {}
