-- AlterTable
ALTER TABLE "tb_command_items" ADD COLUMN     "packPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tb_sale_items" ADD COLUMN     "packPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tb_store_products" ADD COLUMN     "packPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "th_command_item_history" ADD COLUMN     "packPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "th_sale_item_history" ADD COLUMN     "packPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "th_store_product_history" ADD COLUMN     "packPrice" DOUBLE PRECISION;

