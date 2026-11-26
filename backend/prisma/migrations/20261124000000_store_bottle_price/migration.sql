-- Preço próprio do casco por loja (decidido pelo usuário, 2026-11-24). null = vale o preço da empresa.
-- AlterTable
ALTER TABLE "tb_store_bottle_types" ADD COLUMN     "price" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "th_store_bottle_type_history" ADD COLUMN     "price" DOUBLE PRECISION;

