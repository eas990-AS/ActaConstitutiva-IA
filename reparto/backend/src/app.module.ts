import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AlertsModule } from './alerts/alerts.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/auth';
import { CommonModule } from './common/common.module';
import { CourierModule } from './courier/courier.module';
import { EvidencesModule } from './evidences/evidences.module';
import { PackagesModule } from './packages/packages.module';
import { ReportsModule } from './reports/reports.module';
import { TrackingModule } from './tracking/tracking.module';
import { UsersModule } from './users/users.module';
import { ZonesModule } from './zones/zones.module';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '12h' },
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    AuthModule,
    UsersModule,
    ZonesModule,
    PackagesModule,
    CourierModule,
    TrackingModule,
    AlertsModule,
    ReportsModule,
    EvidencesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
