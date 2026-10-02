import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Configuración compartida por main.ts y las pruebas. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  return app;
}
