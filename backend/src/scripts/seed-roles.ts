import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Espejo del seed embebido en la migración add_dynamic_roles. Idempotente:
// se puede ejecutar en cualquier entorno (local o SRV) para re-sincronizar
// roles base y backfill de roleId sin romper datos existentes.
const BASE_ROLES = [
  {
    name: 'SUPERADMIN',
    description: 'Acceso total al sistema',
    allowedModules: ['dashboard', 'clientes', 'packing', 'procesos', 'egresos', 'reportes', 'superadmin'],
    isSystem: true,
  },
  {
    name: 'OWNER',
    description: 'Dueño de la operación',
    allowedModules: ['dashboard', 'clientes', 'packing', 'procesos', 'egresos', 'reportes'],
    isSystem: false,
  },
  {
    name: 'ADMIN',
    description: 'Administrador operativo',
    allowedModules: ['dashboard', 'clientes', 'packing', 'procesos', 'egresos'],
    isSystem: false,
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL requerida');

  const adapter = new PrismaPg({ connectionString: url, max: 2 });
  const prisma = new PrismaClient({ adapter });

  for (const base of BASE_ROLES) {
    await prisma.role.upsert({
      where: { name: base.name },
      update: {
        description: base.description,
        allowedModules: base.allowedModules,
        isSystem: base.isSystem,
      },
      create: base,
    });
    console.log(`[seed:roles] Rol "${base.name}" listo`);
  }

  const legacyRoles = await prisma.user.findMany({
    distinct: ['role'],
    select: { role: true },
  });
  for (const { role } of legacyRoles) {
    const exists = await prisma.role.findUnique({ where: { name: role } });
    if (!exists) {
      await prisma.role.create({
        data: { name: role, allowedModules: ['dashboard'] },
      });
      console.log(`[seed:roles] Rol legacy "${role}" creado`);
    }
  }

  let backfilled = 0;
  for (const { role } of legacyRoles) {
    const target = await prisma.role.findUnique({ where: { name: role } });
    if (!target) continue;
    const res = await prisma.user.updateMany({
      where: { roleId: null, role },
      data: { roleId: target.id },
    });
    backfilled += res.count;
  }
  console.log(`[seed:roles] Backfill de roleId completado (usuarios asignados: ${backfilled})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[seed:roles] Error:', err);
  process.exit(1);
});