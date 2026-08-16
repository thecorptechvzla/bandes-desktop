-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "allowedModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- AlterTable: aditivo, sin tocar la columna legacy "role"
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- SEED + BACKFILL
-- Roles base con UUID fijos. Idempotente (ON CONFLICT) por si la
-- migración se reaplica en entornos que ya tienen datos.
-- ─────────────────────────────────────────────────────────────
INSERT INTO "Role" ("id", "name", "description", "allowedModules", "isSystem", "createdAt", "updatedAt") VALUES
  ('11111111-1111-4111-8111-111111111111', 'SUPERADMIN', 'Acceso total al sistema', ARRAY['dashboard','clientes','packing','procesos','egresos','reportes','superadmin'], true, now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'OWNER', 'Dueño de la operación', ARRAY['dashboard','clientes','packing','procesos','egresos','reportes'], false, now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'ADMIN', 'Administrador operativo', ARRAY['dashboard','clientes','packing','procesos','egresos'], false, now(), now())
ON CONFLICT ("name") DO UPDATE SET
  "allowedModules" = EXCLUDED."allowedModules",
  "isSystem" = EXCLUDED."isSystem",
  "updatedAt" = now();

-- Crea un rol para cualquier valor legacy de "role" que no tenga rol base
-- (p.ej. OPERATOR, AUDITOR) para que ningún usuario quede sin roleId.
INSERT INTO "Role" ("id", "name", "allowedModules", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u.r, ARRAY['dashboard']::TEXT[], false, now(), now()
FROM (SELECT DISTINCT role AS r FROM "User") u
WHERE u.r NOT IN (SELECT "name" FROM "Role");

-- Backfill: asigna roleId a cada usuario según su rol legacy
UPDATE "User"
SET "roleId" = (SELECT "id" FROM "Role" WHERE "Role"."name" = "User"."role")
WHERE "User"."roleId" IS NULL
  AND "User"."role" IN (SELECT "name" FROM "Role");