import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './common/config/configure-app.js';
import { SwaggerModule } from '@nestjs/swagger';
import { createOpenApi } from './common/config/openapi.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  SwaggerModule.setup('docs', app, createOpenApi(app));
  app.enableShutdownHooks();
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}
await bootstrap();
