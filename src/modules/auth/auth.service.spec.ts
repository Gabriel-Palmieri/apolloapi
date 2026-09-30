import { AuthService } from './auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from './supabase.service.js';
import { ConfigService } from '@nestjs/config';
describe('Supabase Auth / perfil local', () => {
  const upsert = vi.fn();
  const getUser = vi.fn();
  const findUnique = vi.fn();
  const service = new AuthService(
    {
      profile: { upsert },
      revokedToken: { findUnique },
    } as unknown as PrismaService,
    { create: () => ({ auth: { getUser } }) } as unknown as SupabaseService,
    new ConfigService(),
  );
  beforeEach(() => vi.resetAllMocks());
  it('ignora role informada pelo usuário', async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'uuid',
          email: 'user@example.com',
          email_confirmed_at: 'now',
          user_metadata: { name: 'Cliente', role: 'ADMIN' },
        },
      },
      error: null,
    });
    await service.authenticate('token');
    expect(upsert.mock.calls[0][0].create.role).toBe('CLIENT');
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('role');
  });
  it('nega token inválido sem criar perfil', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid' },
    });
    await expect(service.authenticate('invalid')).rejects.toThrow(
      'Sessão inválida',
    );
    expect(upsert).not.toHaveBeenCalled();
  });
  it('nega token já encerrado antes de chamar o provedor', async () => {
    findUnique.mockResolvedValue({ digest: 'x' });
    await expect(service.authenticate('revoked')).rejects.toThrow(
      'Sessão encerrada',
    );
    expect(getUser).not.toHaveBeenCalled();
  });
});
