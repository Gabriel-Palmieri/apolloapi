import { validateEnvironment } from './environment.js';
const valid = {
  DATABASE_URL: 'postgresql://user:secret@localhost/db',
  DIRECT_URL: 'postgresql://user:secret@localhost/db',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  FRONTEND_URL: 'http://localhost:5173',
};
describe('Configuração', () => {
  it('aplica porta padrão', () =>
    expect(validateEnvironment(valid).PORT).toBe(3000));
  it('recusa configuração incompleta sem mostrar credenciais', () => {
    try {
      validateEnvironment({ ...valid, SUPABASE_PUBLISHABLE_KEY: '' });
      throw new Error('accepted');
    } catch (e) {
      expect(String(e)).toContain('SUPABASE_PUBLISHABLE_KEY');
      expect(String(e)).not.toContain('user:secret');
    }
  });
  it('recusa placeholder', () =>
    expect(() =>
      validateEnvironment({
        ...valid,
        DIRECT_URL: 'postgresql://user:PASSWORD@host/db',
      }),
    ).toThrow('DIRECT_URL'));
  it('recusa URL HTTP como conexão SQL', () =>
    expect(() =>
      validateEnvironment({ ...valid, DATABASE_URL: 'https://example.com' }),
    ).toThrow('DATABASE_URL'));
});
