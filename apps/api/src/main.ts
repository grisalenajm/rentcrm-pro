import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) throw new Error('FRONTEND_URL no definida — abortando startup');
  app.enableCors({ origin: frontendUrl, credentials: true });

  app.setGlobalPrefix('api');

  const logger = new Logger('Bootstrap');
  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  logger.log(`Aplicación iniciada en puerto ${port}`);
}
bootstrap();
