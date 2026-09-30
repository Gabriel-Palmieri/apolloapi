-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('SALE', 'RENTAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "authUserId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "document" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "collection" TEXT,
    "fabric" TEXT,
    "color" TEXT,
    "line" TEXT,
    "photoUrl" TEXT,
    "rentalPriceCents" INTEGER NOT NULL,
    "salePriceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "protocol" TEXT NOT NULL,
    "profileId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "type" "OperationType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "startDate" DATE,
    "endDate" DATE,
    "quotedPriceCents" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerDocument" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderHistory" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "profileId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "type" "OperationType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "priceCents" INTEGER NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "confirmedAt" TIMESTAMPTZ(3),
    "pickedUpAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "damageNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "paidAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedToken" (
    "digest" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("digest")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_authUserId_key" ON "Profile"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_productId_size_key" ON "Variant"("productId", "size");

-- CreateIndex
CREATE UNIQUE INDEX "Order_protocol_key" ON "Order"("protocol");

-- CreateIndex
CREATE INDEX "Order_profileId_createdAt_idx" ON "Order"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderHistory_orderId_createdAt_idx" ON "OrderHistory"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_orderId_key" ON "Transaction"("orderId");

-- CreateIndex
CREATE INDEX "Transaction_variantId_status_startDate_endDate_idx" ON "Transaction"("variantId", "status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Transaction_profileId_createdAt_idx" ON "Transaction"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderHistory" ADD CONSTRAINT "OrderHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants remain valid even outside the HTTP API.
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_quantity_nonnegative" CHECK ("quantity" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_prices_nonnegative" CHECK ("rentalPriceCents" >= 0 AND "salePriceCents" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_price_nonnegative" CHECK ("quotedPriceCents" >= 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_price_nonnegative" CHECK ("priceCents" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_simulated_nonnegative" CHECK ("amountCents" >= 0 AND "simulated" = true);
ALTER TABLE "Order" ADD CONSTRAINT "Order_dates" CHECK (
  ("type" = 'SALE' AND "startDate" IS NULL AND "endDate" IS NULL) OR
  ("type" = 'RENTAL' AND "startDate" IS NOT NULL AND "endDate" IS NOT NULL AND "endDate" >= "startDate")
);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_dates" CHECK (
  ("type" = 'SALE' AND "startDate" IS NULL AND "endDate" IS NULL) OR
  ("type" = 'RENTAL' AND "startDate" IS NOT NULL AND "endDate" IS NOT NULL AND "endDate" >= "startDate")
);

-- Only the NestJS server database connection accesses business records.
-- No client-facing Supabase policies are installed.
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Variant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevokedToken" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE app_role text; app_table text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      FOREACH app_table IN ARRAY ARRAY['Profile','Product','Variant','Order','OrderHistory','Transaction','Payment','RevokedToken'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', current_schema(), app_table, app_role);
      END LOOP;
    END IF;
  END LOOP;
END $$;
