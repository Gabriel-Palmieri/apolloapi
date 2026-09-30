export function validateEnvironment(input: Record<string, unknown>) {
  const errors: string[] = [];
  for (const key of [
    'DATABASE_URL',
    'DIRECT_URL',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'FRONTEND_URL',
  ]) {
    const value = input[key];
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      /PROJECT_REF|PASSWORD|YOUR_|\[.*\]|<.*>/i.test(value)
    )
      errors.push(key);
  }
  for (const key of [
    'DATABASE_URL',
    'DIRECT_URL',
    'SUPABASE_URL',
    'FRONTEND_URL',
  ]) {
    try {
      const url = new URL(String(input[key]));
      const allowed =
        key === 'DATABASE_URL' || key === 'DIRECT_URL'
          ? ['postgres:', 'postgresql:']
          : ['https:', 'http:'];
      if (!allowed.includes(url.protocol)) errors.push(key);
    } catch {
      errors.push(key);
    }
  }
  const port = Number(input.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT');
  if (errors.length)
    throw new Error(
      `Configuração ausente ou inválida: ${[...new Set(errors)].join(', ')}. Consulte .env.example.`,
    );
  return { ...input, PORT: port };
}
