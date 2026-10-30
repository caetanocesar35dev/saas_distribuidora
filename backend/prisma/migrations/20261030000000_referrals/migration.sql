-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DiscountReason" AS ENUM ('REFERRED', 'REFERRER');

-- AlterTable
ALTER TABLE "tb_organizations" ADD COLUMN     "referralCode" TEXT;

-- AlterTable
ALTER TABLE "th_organization_history" ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "tb_sales_representatives" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "pixKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionPercent" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_sales_representatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_referrals" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "referredOrganizationId" TEXT NOT NULL,
    "referrerOrganizationId" TEXT,
    "representativeId" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "note" TEXT,
    "confirmedPlanId" TEXT,
    "confirmedPlanPriceInCents" INTEGER,
    "commissionInCents" INTEGER,
    "commissionPaidAt" TIMESTAMP(3),
    "commissionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_subscription_discounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "reason" "DiscountReason" NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "months" INTEGER NOT NULL,
    "monthsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_subscription_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "th_sales_representative_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "pixKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionPercent" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_sales_representative_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_referral_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "referredOrganizationId" TEXT NOT NULL,
    "referrerOrganizationId" TEXT,
    "representativeId" TEXT,
    "status" "ReferralStatus" NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "note" TEXT,
    "confirmedPlanId" TEXT,
    "confirmedPlanPriceInCents" INTEGER,
    "commissionInCents" INTEGER,
    "commissionPaidAt" TIMESTAMP(3),
    "commissionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_referral_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_subscription_discount_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "reason" "DiscountReason" NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "months" INTEGER NOT NULL,
    "monthsUsed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_subscription_discount_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_sales_representatives_code_key" ON "tb_sales_representatives"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tb_referrals_referredOrganizationId_key" ON "tb_referrals"("referredOrganizationId");

-- CreateIndex
CREATE INDEX "tb_referrals_referrerOrganizationId_idx" ON "tb_referrals"("referrerOrganizationId");

-- CreateIndex
CREATE INDEX "tb_referrals_representativeId_idx" ON "tb_referrals"("representativeId");

-- CreateIndex
CREATE INDEX "tb_referrals_status_idx" ON "tb_referrals"("status");

-- CreateIndex
CREATE INDEX "tb_subscription_discounts_organizationId_idx" ON "tb_subscription_discounts"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_subscription_discounts_referralId_reason_key" ON "tb_subscription_discounts"("referralId", "reason");

-- CreateIndex
CREATE INDEX "ix_th_sales_representative_history_vigente" ON "th_sales_representative_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_referral_history_vigente" ON "th_referral_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_subscription_discount_history_vigente" ON "th_subscription_discount_history"("id", "historyEnd");

-- CreateIndex
CREATE UNIQUE INDEX "tb_organizations_referralCode_key" ON "tb_organizations"("referralCode");

-- AddForeignKey
ALTER TABLE "tb_referrals" ADD CONSTRAINT "tb_referrals_referredOrganizationId_fkey" FOREIGN KEY ("referredOrganizationId") REFERENCES "tb_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_referrals" ADD CONSTRAINT "tb_referrals_referrerOrganizationId_fkey" FOREIGN KEY ("referrerOrganizationId") REFERENCES "tb_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_referrals" ADD CONSTRAINT "tb_referrals_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "tb_sales_representatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_referrals" ADD CONSTRAINT "tb_referrals_confirmedPlanId_fkey" FOREIGN KEY ("confirmedPlanId") REFERENCES "tb_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_subscription_discounts" ADD CONSTRAINT "tb_subscription_discounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "tb_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_subscription_discounts" ADD CONSTRAINT "tb_subscription_discounts_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "tb_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Auditoria e soft delete das tabelas novas (mesmo padrão da migration auditoria_triggers).

-- tb_sales_representatives
CREATE TRIGGER tr_auditoria_tb_sales_representatives
AFTER INSERT OR UPDATE ON "tb_sales_representatives"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_sales_representative_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_sales_representatives
BEFORE DELETE ON "tb_sales_representatives"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_referrals
CREATE TRIGGER tr_auditoria_tb_referrals
AFTER INSERT OR UPDATE ON "tb_referrals"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_referral_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_referrals
BEFORE DELETE ON "tb_referrals"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- tb_subscription_discounts
CREATE TRIGGER tr_auditoria_tb_subscription_discounts
AFTER INSERT OR UPDATE ON "tb_subscription_discounts"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_subscription_discount_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_subscription_discounts
BEFORE DELETE ON "tb_subscription_discounts"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

