import 'dotenv/config';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const identifier = process.argv[2];
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier ?? '');
const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier ?? '');
if (!isUuid && !isEmail) {
  console.error('Usage: npm run admin:promote -- <Supabase user UUID or existing profile email>');
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Configure DIRECT_URL or DATABASE_URL in .env.');
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const profiles = await db.profile.findMany({
    where: isUuid
      ? { authUserId: identifier }
      : { email: { equals: identifier, mode: 'insensitive' } },
    select: { id: true },
    take: 2,
  });
  if (profiles.length !== 1) {
    console.error(profiles.length === 0
      ? 'Profile not found. Confirm the account email and log in once before promotion.'
      : 'Multiple profiles match this email. Use the Supabase user UUID.');
    process.exitCode = 1;
  } else {
    await db.profile.update({ where: { id: profiles[0].id }, data: { role: 'ADMIN' } });
    console.log('Profile promoted to administrator.');
  }
} catch {
  console.error('Promotion failed. Check the database connection and profile.');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
