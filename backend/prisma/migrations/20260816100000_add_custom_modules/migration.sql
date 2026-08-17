-- Fase 4.6: Permisos personalizados por usuario (override sobre el rol).
-- customModules: [] (o ausente) => el usuario hereda los allowedModules de su Role.
ALTER TABLE "User" ADD COLUMN "customModules" TEXT[] NOT NULL DEFAULT '{}'::TEXT[];