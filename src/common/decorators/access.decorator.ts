import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Profile } from '../../generated/prisma/client.js';

export const Public = () => SetMetadata('public', true);

export const Admin = () => SetMetadata('admin', true);

export interface AuthenticatedRequest extends Request {
  user: Profile;
  accessToken: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Profile =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
