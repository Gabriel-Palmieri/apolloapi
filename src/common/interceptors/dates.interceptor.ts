import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';
import type { Response } from 'express';
export function serializeDates(value: unknown, key = ''): unknown {
  if (value instanceof Date)
    return ['startDate', 'endDate'].includes(key)
      ? value.toISOString().slice(0, 10)
      : value.toISOString();
  if (Array.isArray(value)) return value.map((item) => serializeDates(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeDates(v, k)]),
    );
  return value;
}
@Injectable()
export class DatesInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    return next.handle().pipe(map((data) => serializeDates(data)));
  }
}
