-- AlterTable
ALTER TABLE "tb_memberships" ADD COLUMN     "isGeneralManager" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "th_membership_history" ADD COLUMN     "isGeneralManager" BOOLEAN NOT NULL DEFAULT false;

