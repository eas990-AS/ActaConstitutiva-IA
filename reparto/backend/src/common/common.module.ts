import { Global, Module } from '@nestjs/common';
import { LiveGateway } from './live.gateway';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [PrismaService, StorageService, LiveGateway],
  exports: [PrismaService, StorageService, LiveGateway],
})
export class CommonModule {}
