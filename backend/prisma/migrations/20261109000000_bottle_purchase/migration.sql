-- Compra do casco do vasilhame na venda (decidido pelo usuário, 2026-11-09).

-- AlterEnum
ALTER TYPE "BottleMovementType" ADD VALUE 'CUSTOMER_PURCHASE';

-- AlterTable
ALTER TABLE "tb_bottle_movements" ADD COLUMN     "unitPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tb_bottle_types" ADD COLUMN     "price" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tb_sales" ADD COLUMN     "bottlesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "th_bottle_movement_history" ADD COLUMN     "unitPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "th_bottle_type_history" ADD COLUMN     "price" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "th_sale_history" ADD COLUMN     "bottlesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
