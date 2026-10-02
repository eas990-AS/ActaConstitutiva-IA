import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { toUser } from '../common/mappers';
import { PrismaService } from '../common/prisma.service';
import { scopeZone } from '../common/scope';

class CreateUserDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @Matches(/^[a-zA-Z0-9._-]{3,40}$/, { message: 'Usuario: 3 a 40 letras, números, punto, guion' })
  username: string;
  @IsString() @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' }) password: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() zoneId?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() zoneId?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller('users')
class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('ADMIN', 'SUPERVISOR')
  async list(
    @CurrentUser() auth: AuthUser,
    @Query('role') role?: Role,
    @Query('zoneId') zoneId?: string,
  ) {
    if (auth.role === 'SUPERVISOR' && role !== 'COURIER') {
      throw new ForbiddenException('Los supervisores solo pueden listar repartidores');
    }
    if (role && !Object.values(Role).includes(role)) throw new BadRequestException('Rol inválido');
    const zone = scopeZone(auth, zoneId);
    const users = await this.prisma.user.findMany({
      where: { role: role || undefined, zoneId: zone },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    return users.map(toUser);
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateUserDto) {
    await this.assertZone(dto.zoneId);
    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          username: dto.username.toLowerCase(),
          passwordHash: await bcrypt.hash(dto.password, 10),
          role: dto.role,
          phone: dto.phone || null,
          zoneId: dto.zoneId || null,
        },
      });
      return toUser(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ese nombre de usuario ya existe');
      }
      throw e;
    }
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    if (!(await this.prisma.user.findUnique({ where: { id } }))) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (dto.zoneId) await this.assertZone(dto.zoneId);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone,
        zoneId: dto.zoneId === undefined ? undefined : dto.zoneId || null,
        active: dto.active,
        passwordHash: dto.password ? await bcrypt.hash(dto.password, 10) : undefined,
      },
    });
    return toUser(user);
  }

  private async assertZone(zoneId?: string) {
    if (zoneId && !(await this.prisma.zone.findFirst({ where: { id: zoneId, active: true } }))) {
      throw new BadRequestException('La zona no existe');
    }
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
