-- Controle de acesso pela assinatura: fim do trial e início do atraso (base da carência).
-- As colunas também entram em th_organization_history, então o trigger genérico já as versiona.

-- AlterTable
ALTER TABLE "tb_organizations" ADD COLUMN     "pastDueSince" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "th_organization_history" ADD COLUMN     "pastDueSince" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

