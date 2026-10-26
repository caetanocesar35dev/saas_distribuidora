-- AlterTable
ALTER TABLE "tb_cash_registers" ADD COLUMN     "autoClosed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tb_stores" ADD COLUMN     "cashAutoCloseTime" TEXT NOT NULL DEFAULT '00:00';

-- AlterTable
ALTER TABLE "th_cash_register_history" ADD COLUMN     "autoClosed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "th_store_history" ADD COLUMN     "cashAutoCloseTime" TEXT NOT NULL DEFAULT '00:00';

