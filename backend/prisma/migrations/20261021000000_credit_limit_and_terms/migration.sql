-- AlterTable
ALTER TABLE "tb_customers" ADD COLUMN     "creditLimit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tb_users" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "th_customer_history" ADD COLUMN     "creditLimit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "th_user_history" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

