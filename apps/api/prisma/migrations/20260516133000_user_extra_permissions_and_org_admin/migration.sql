ALTER TABLE "users" ADD COLUMN "extra_permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DROP TABLE IF EXISTS "_AdditionalRoles";
