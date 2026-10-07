-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('ASAAS');

-- CreateEnum
CREATE TYPE "BillingMethod" AS ENUM ('CREDIT_CARD', 'PIX_AUTOMATIC');

-- AlterTable
ALTER TABLE "tb_organizations" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId",
ADD COLUMN     "billingCustomerId" TEXT,
ADD COLUMN     "billingDocument" TEXT,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "billingMethod" "BillingMethod",
ADD COLUMN     "billingPixAuthorizationId" TEXT,
ADD COLUMN     "billingProvider" "BillingProvider",
ADD COLUMN     "billingSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "th_organization_history" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId",
ADD COLUMN     "billingCustomerId" TEXT,
ADD COLUMN     "billingDocument" TEXT,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "billingMethod" "BillingMethod",
ADD COLUMN     "billingPixAuthorizationId" TEXT,
ADD COLUMN     "billingProvider" "BillingProvider",
ADD COLUMN     "billingSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "tb_billing_events" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "organizationId" TEXT,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "th_billing_event_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "organizationId" TEXT,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_billing_event_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateIndex
CREATE INDEX "tb_billing_events_organizationId_idx" ON "tb_billing_events"("organizationId");

-- CreateIndex
CREATE INDEX "tb_billing_events_processedAt_idx" ON "tb_billing_events"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tb_billing_events_provider_externalEventId_key" ON "tb_billing_events"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "ix_th_billing_event_history_vigente" ON "th_billing_event_history"("id", "historyEnd");

-- CreateIndex
CREATE UNIQUE INDEX "tb_organizations_billingCustomerId_key" ON "tb_organizations"("billingCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_organizations_billingSubscriptionId_key" ON "tb_organizations"("billingSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_organizations_billingPixAuthorizationId_key" ON "tb_organizations"("billingPixAuthorizationId");

-- AddForeignKey
ALTER TABLE "tb_billing_events" ADD CONSTRAINT "tb_billing_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "tb_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================
-- Auditoria e soft delete da tabela nova (mesmo padrão da migration auditoria_triggers).
-- As colunas novas de tb_organizations já são auditadas: o trigger casa por nome e as
-- mesmas colunas foram criadas em th_organization_history acima.
-- ============================================================

-- tb_billing_events
CREATE TRIGGER tr_auditoria_tb_billing_events
AFTER INSERT OR UPDATE ON "tb_billing_events"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_billing_event_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_billing_events
BEFORE DELETE ON "tb_billing_events"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();
