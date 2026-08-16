import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
const { hash } = bcryptjs;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL requerida');

  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 6) {
    throw new Error('ADMIN_PASSWORD requerida (mínimo 6 caracteres)');
  }

  const adapter = new PrismaPg({ connectionString: url, max: 2 });
  const prisma = new PrismaClient({ adapter });

  const username = process.env.ADMIN_USERNAME || 'admin';
  const role = (process.env.ADMIN_ROLE || 'SUPERADMIN').toUpperCase();
  const VALID_ROLES = ['SUPERADMIN', 'OWNER', 'ADMIN'];
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`ADMIN_ROLE inválida (${VALID_ROLES.join('|')})`);
  }
  const passwordHash = await hash(password, 10);

  const roleRecord = await prisma.role.findUnique({ where: { name: role } });

  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, role, active: true, roleId: roleRecord?.id ?? null },
    create: { username, passwordHash, role, roleId: roleRecord?.id ?? null },
  });

  console.log(`[seed-admin] Usuario "${user.username}" listo (role=${user.role})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[seed-admin] Error:', err);
  process.exit(1);
});