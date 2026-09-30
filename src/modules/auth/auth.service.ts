import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { User, Session } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from './supabase.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private digest(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async ensureProfile(user: User) {
    const name: unknown = user.user_metadata?.name;
    return this.prisma.profile.upsert({
      where: { authUserId: user.id },
      create: {
        authUserId: user.id,
        email: user.email ?? '',
        name: typeof name === 'string' ? name.slice(0, 100) : 'Cliente',
        role: 'CLIENT',
      },
      update: { email: user.email ?? '' },
    });
  }

  private session(session: Session) {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
      expiresIn: session.expires_in,
      tokenType: 'Bearer',
    };
  }

  async register(dto: RegisterDto) {
    const { data, error } = await this.supabase.create().auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        data: { name: dto.name },
        emailRedirectTo:
          this.config.getOrThrow<string>('FRONTEND_URL') + '/auth/callback',
      },
    });
    if (error)
      throw new BadRequestException(
        'Não foi possível cadastrar. Confira os dados informados.',
      );
    // No session until email confirmation; profile is reconciled on first login.
    if (data.user && data.session) await this.ensureProfile(data.user);
    return {
      message: 'Confira seu e-mail para confirmar o cadastro.',
      session: data.session ? this.session(data.session) : null,
    };
  }

  async login(dto: LoginDto) {
    const { data, error } = await this.supabase
      .create()
      .auth.signInWithPassword(dto);
    if (error || !data.session)
      throw new UnauthorizedException(
        'E-mail ou senha inválidos, ou e-mail não confirmado.',
      );
    return {
      ...this.session(data.session),
      user: await this.ensureProfile(data.user),
    };
  }

  async refresh(refreshToken: string) {
    const { data, error } = await this.supabase
      .create()
      .auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user)
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    return {
      ...this.session(data.session),
      user: await this.ensureProfile(data.user),
    };
  }

  async authenticate(token: string) {
    if (
      await this.prisma.revokedToken.findUnique({
        where: { digest: this.digest(token) },
      })
    )
      throw new UnauthorizedException('Sessão encerrada.');
    const { data, error } = await this.supabase.create().auth.getUser(token);
    if (error || !data.user || !data.user.email_confirmed_at)
      throw new UnauthorizedException('Sessão inválida.');
    return this.ensureProfile(data.user);
  }

  async logout(token: string) {
    // The guard has already verified this token. Block it locally as Supabase access JWTs survive sign-out until expiry.
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    ) as { exp: number };
    const response = await this.supabase
      .authenticatedRequest('logout?scope=local', token, 'POST')
      .catch(() => null);
    if (!response?.ok)
      throw new ServiceUnavailableException(
        'Não foi possível encerrar a sessão no provedor. Tente novamente.',
      );
    await this.prisma.revokedToken.upsert({
      where: { digest: this.digest(token) },
      create: {
        digest: this.digest(token),
        expiresAt: new Date(payload.exp * 1000),
      },
      update: {},
    });
    await this.prisma.revokedToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return { message: 'Sessão encerrada.' };
  }

  async requestPasswordReset(email: string) {
    const { error } = await this.supabase
      .create()
      .auth.resetPasswordForEmail(email, {
        redirectTo:
          this.config.getOrThrow<string>('FRONTEND_URL') +
          '/auth/reset-password',
      });
    if (error && error.status && error.status >= 500)
      throw new ServiceUnavailableException(
        'Recuperação indisponível. Tente novamente.',
      );
    return {
      message: 'Se houver uma conta, as instruções serão enviadas por e-mail.',
    };
  }

  async resetPassword(token: string, password: string) {
    const response = await this.supabase
      .authenticatedRequest('user', token, 'PUT', { password })
      .catch(() => null);
    if (!response?.ok)
      throw new BadRequestException('Não foi possível atualizar a senha.');
    return { message: 'Senha atualizada.' };
  }

  updateProfile(id: string, data: UpdateProfileDto) {
    return this.prisma.profile.update({ where: { id }, data });
  }
}
