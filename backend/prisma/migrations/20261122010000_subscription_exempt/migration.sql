-- Conta isenta de mensalidade (decidido pelo usuário, 2026-11-22).

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'EXEMPT';

-- AlterTable
ALTER TABLE "tb_organizations" ADD COLUMN     "exemptReason" TEXT,
ADD COLUMN     "exemptUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "th_organization_history" ADD COLUMN     "exemptReason" TEXT,
ADD COLUMN     "exemptUntil" TIMESTAMP(3);
