-- AlterTable
ALTER TABLE "tb_command_items" ADD COLUMN     "packSize" INTEGER,
ADD COLUMN     "packs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tb_sale_items" ADD COLUMN     "packSize" INTEGER,
ADD COLUMN     "packs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "th_command_item_history" ADD COLUMN     "packSize" INTEGER,
ADD COLUMN     "packs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "th_sale_item_history" ADD COLUMN     "packSize" INTEGER,
ADD COLUMN     "packs" INTEGER NOT NULL DEFAULT 0;

