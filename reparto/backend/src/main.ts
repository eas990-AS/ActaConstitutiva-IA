import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET es obligatorio en producción');
  }
  const app = configureApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`API de reparto escuchando en http://localhost:${port}/api`);
}

bootstrap();
