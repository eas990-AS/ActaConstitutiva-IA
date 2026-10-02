import { Controller, ForbiddenException, Get, Module, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/auth';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';

@Controller('evidences')
class EvidencesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Acceso con URL firmada (para usarla directo en <img>). */
  @Public()
  @Get(':id/file')
  async file(
    @Param('id') id: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    if (!this.storage.verify(id, Number(exp), sig)) throw new ForbiddenException('Enlace vencido o inválido');
    const evidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!evidence) throw new NotFoundException('Evidencia no encontrada');
    res.setHeader('Content-Type', evidence.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=900');
    res.sendFile(this.storage.filePath(evidence.storageKey));
  }
}

@Module({ controllers: [EvidencesController] })
export class EvidencesModule {}
