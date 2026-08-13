import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
const { hash } = bcryptjs;

const VALID_ROLES = ['SUPERADMIN', 'OWNER', 'ADMIN'];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL requerida');

  const username = process.env.USER_USERNAME;
  const password = process.env.USER_PASSWORD;
  const role = (process.env.USER_ROLE || 'OWNER').toUpperCase();

  if (!username) throw new Error('USER_USERNAME requerido');
  if (!password || password.length < 6) {
    throw new Error('USER_PASSWORD requerida (mínimo 6 caracteres)');
  }
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`USER_ROLE inválida (${VALID_ROLES.join('|')})`);
  }

  const adapter = new PrismaPg({ connectionString: url, max: 2 });
  const prisma = new PrismaClient({ adapter });

  const passwordHash = await hash(password, 10);
  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, role, active: true },
    create: { username, passwordHash, role },
  });

  console.log(`[add-user] Usuario "${user.username}" listo (role=${user.role})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[add-user] Error:', err);
  process.exit(1);
});