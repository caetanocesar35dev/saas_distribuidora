-- AlterTable
ALTER TABLE "tb_sales" ADD COLUMN     "creditApprovedById" TEXT;

-- AlterTable
ALTER TABLE "th_sale_history" ADD COLUMN     "creditApprovedById" TEXT;

-- AddForeignKey
ALTER TABLE "tb_sales" ADD CONSTRAINT "tb_sales_creditApprovedById_fkey" FOREIGN KEY ("creditApprovedById") REFERENCES "tb_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

