import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../modules/auth/auth.service.js';
import type { AuthenticatedRequest } from '../decorators/access.decorator.js';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Autenticação obrigatória.');
    req.accessToken = match[1];
    req.user = await this.auth.authenticate(match[1]);
    if (
      this.reflector.getAllAndOverride<boolean>('admin', [
        context.getHandler(),
        context.getClass(),
      ]) &&
      req.user.role !== 'ADMIN'
    )
      throw new ForbiddenException('Acesso exclusivo do administrador.');
    return true;
  }
}
