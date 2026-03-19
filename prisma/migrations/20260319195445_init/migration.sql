-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('deposit', 'withdraw', 'transfer');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('processed', 'invalid', 'duplicate');

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,
    "from_user_id" TEXT,
    "to_user_id" TEXT,
    "status" "TransactionStatus" NOT NULL,
    "error_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_balances" (
    "user_id" TEXT NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_balances_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_external_id_key" ON "transactions"("external_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_from_user_id_idx" ON "transactions"("from_user_id");

-- CreateIndex
CREATE INDEX "transactions_to_user_id_idx" ON "transactions"("to_user_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_timestamp_idx" ON "transactions"("timestamp");
