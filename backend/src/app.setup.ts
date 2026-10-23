import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { Env } from './config/env';

/** Configuração HTTP compartilhada entre main.ts e os testes e2e. */
export function configureApp(
  app: INestApplication,
  options: { swagger?: boolean } = {},
) {
  const config = app.get(ConfigService<Env, true>);

  // O frontend (Next) chama a API por um servidor intermediário (BFF) e repassa o IP real do
  // navegador em X-Forwarded-For. Só proxies de loopback/rede privada são confiáveis, então um
  // cliente da internet não consegue forjar o IP para fugir do rate limit.
  (app.getHttpAdapter().getInstance() as Express).set(
    'trust proxy',
    'loopback, linklocal, uniquelocal',
  );

  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
  if (options.swagger ?? !isProd) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SaaS Distribuidora')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
}
