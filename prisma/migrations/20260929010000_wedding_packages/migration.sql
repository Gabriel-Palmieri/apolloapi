CREATE TYPE "WeddingPackageStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'CLOSED');

CREATE TABLE "WeddingPackage" (
    "id" UUID NOT NULL,
    "profileId" UUID,
    "baseProductId" UUID,
    "coupleNames" TEXT NOT NULL,
    "eventDate" DATE,
    "expectedMembers" INTEGER NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "WeddingPackageStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "WeddingPackage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WeddingPackage_expectedMembers_check" CHECK ("expectedMembers" BETWEEN 1 AND 30)
);

CREATE TABLE "WeddingPackageParticipant" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeddingPackageParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeddingPackage_status_createdAt_idx" ON "WeddingPackage"("status", "createdAt");
CREATE INDEX "WeddingPackage_profileId_createdAt_idx" ON "WeddingPackage"("profileId", "createdAt");
CREATE INDEX "WeddingPackageParticipant_packageId_createdAt_idx" ON "WeddingPackageParticipant"("packageId", "createdAt");
ALTER TABLE "WeddingPackage" ADD CONSTRAINT "WeddingPackage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeddingPackage" ADD CONSTRAINT "WeddingPackage_baseProductId_fkey" FOREIGN KEY ("baseProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeddingPackageParticipant" ADD CONSTRAINT "WeddingPackageParticipant_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "WeddingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeddingPackage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeddingPackageParticipant" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE app_role text; app_table text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      FOREACH app_table IN ARRAY ARRAY['WeddingPackage','WeddingPackageParticipant'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', current_schema(), app_table, app_role);
      END LOOP;
    END IF;
  END LOOP;
END $$;
