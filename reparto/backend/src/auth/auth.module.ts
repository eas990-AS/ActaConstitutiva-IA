import { Body, Controller, Get, Module, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { IsString, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { toUser } from '../common/mappers';
import { PrismaService } from '../common/prisma.service';

class LoginDto {
  @IsString() @MinLength(1) username: string;
  @IsString() @MinLength(1) password: string;
}

@Controller('auth')
class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username.trim().toLowerCase() },
    });
    const ok = user && user.active && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!ok) throw new UnauthorizedException('Usuario o contraseña incorrectos');
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken, user: toUser(user) };
  }

  @Get('me')
  async me(@CurrentUser() auth: AuthUser) {
    return toUser(await this.prisma.user.findUniqueOrThrow({ where: { id: auth.id } }));
  }
}

@Module({ controllers: [AuthController] })
export class AuthModule {}
