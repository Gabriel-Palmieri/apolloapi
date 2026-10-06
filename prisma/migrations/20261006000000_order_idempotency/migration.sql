-- Nullable fields preserve orders and clients created before idempotency support.
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" UUID;
ALTER TABLE "Order" ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "Order_profileId_idempotencyKey_key" ON "Order"("profileId", "idempotencyKey");