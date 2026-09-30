import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { ApiExceptionFilter } from '../filters/api-exception.filter.js';
import { DatesInterceptor } from '../interceptors/dates.interceptor.js';
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: app.get(ConfigService).getOrThrow<string>('FRONTEND_URL'),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new DatesInterceptor());
}
