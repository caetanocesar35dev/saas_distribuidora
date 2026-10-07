-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPPORT', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MONEY', 'PIX', 'DEBIT', 'CREDIT', 'CREDIT_STORE');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CashStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'SALE');

-- CreateEnum
CREATE TYPE "TabStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "BottleMovementType" AS ENUM ('CUSTOMER_BORROW', 'CUSTOMER_RETURN', 'SUPPLIER_SEND', 'SUPPLIER_RECEIVE', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEWS', 'UPDATE', 'MAINTENANCE', 'ALERT');

-- CreateTable
CREATE TABLE "tb_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "platformRole" "PlatformRole",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_companies" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "maxCompanies" INTEGER,
    "maxStoresPerCompany" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_stores" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "phone" TEXT,
    "zipCode" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_membership_stores" (
    "membershipId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_membership_stores_pkey" PRIMARY KEY ("membershipId","storeId")
);

-- CreateTable
CREATE TABLE "tb_products" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packQuantity" INTEGER NOT NULL DEFAULT 1,
    "bottleTypeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_store_products" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_store_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_bottle_types" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_bottle_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_store_bottle_types" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "bottleTypeId" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_store_bottle_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_customers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_customer_store_balances" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_customer_store_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_customer_payments" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_customer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_customer_payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_customer_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_customer_store_bottle_balances" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "bottleTypeId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_customer_store_bottle_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_sales" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "customerId" TEXT,
    "commandTabId" TEXT,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_cash_registers" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalBalance" DOUBLE PRECISION,
    "status" "CashStatus" NOT NULL DEFAULT 'OPEN',
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_cash_movements" (
    "id" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_command_tabs" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TabStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_command_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_command_items" (
    "id" TEXT NOT NULL,
    "commandTabId" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_command_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_bottle_movements" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "bottleTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "type" "BottleMovementType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    "saleId" TEXT,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_bottle_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'NEWS',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_notification_reads" (
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_notification_reads_pkey" PRIMARY KEY ("notificationId","userId")
);

-- CreateTable
CREATE TABLE "th_user_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "platformRole" "PlatformRole",
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_user_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_company_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_company_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_membership_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_membership_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_organization_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_organization_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_plan_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "maxCompanies" INTEGER,
    "maxStoresPerCompany" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_plan_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_store_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "phone" TEXT,
    "zipCode" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_store_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_membership_store_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "membershipId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_membership_store_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_product_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packQuantity" INTEGER NOT NULL,
    "bottleTypeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_product_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_store_product_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_store_product_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_bottle_type_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_bottle_type_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_store_bottle_type_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "bottleTypeId" TEXT NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_store_bottle_type_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_customer_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_customer_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_customer_store_balance_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_customer_store_balance_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_customer_payment_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_customer_payment_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_customer_payment_allocation_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_customer_payment_allocation_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_customer_store_bottle_balance_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "bottleTypeId" TEXT NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_customer_store_bottle_balance_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_sale_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "SaleStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "commandTabId" TEXT,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_sale_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_sale_item_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_sale_item_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_cash_register_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "initialBalance" DOUBLE PRECISION NOT NULL,
    "finalBalance" DOUBLE PRECISION,
    "status" "CashStatus" NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_cash_register_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_cash_movement_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_cash_movement_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_command_tab_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TabStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_command_tab_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_command_item_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "commandTabId" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_command_item_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_bottle_movement_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "bottleTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "type" "BottleMovementType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "saleId" TEXT,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_bottle_movement_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_notification_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_notification_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "th_notification_read_history" (
    "historyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "historyStart" TIMESTAMP(3) NOT NULL,
    "historyEnd" TIMESTAMP(3),

    CONSTRAINT "th_notification_read_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_users_email_key" ON "tb_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tb_companies_cnpj_key" ON "tb_companies"("cnpj");

-- CreateIndex
CREATE INDEX "tb_companies_organizationId_idx" ON "tb_companies"("organizationId");

-- CreateIndex
CREATE INDEX "tb_memberships_companyId_idx" ON "tb_memberships"("companyId");

-- CreateIndex
CREATE INDEX "tb_memberships_userId_idx" ON "tb_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_memberships_userId_companyId_key" ON "tb_memberships"("userId", "companyId");

-- CreateIndex
CREATE INDEX "tb_organizations_ownerUserId_idx" ON "tb_organizations"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_plans_name_key" ON "tb_plans"("name");

-- CreateIndex
CREATE INDEX "tb_stores_companyId_idx" ON "tb_stores"("companyId");

-- CreateIndex
CREATE INDEX "tb_membership_stores_storeId_idx" ON "tb_membership_stores"("storeId");

-- CreateIndex
CREATE INDEX "tb_products_companyId_idx" ON "tb_products"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_products_companyId_code_key" ON "tb_products"("companyId", "code");

-- CreateIndex
CREATE INDEX "tb_store_products_storeId_idx" ON "tb_store_products"("storeId");

-- CreateIndex
CREATE INDEX "tb_store_products_productId_idx" ON "tb_store_products"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_store_products_storeId_productId_key" ON "tb_store_products"("storeId", "productId");

-- CreateIndex
CREATE INDEX "tb_bottle_types_companyId_idx" ON "tb_bottle_types"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_bottle_types_companyId_name_key" ON "tb_bottle_types"("companyId", "name");

-- CreateIndex
CREATE INDEX "tb_store_bottle_types_storeId_idx" ON "tb_store_bottle_types"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_store_bottle_types_storeId_bottleTypeId_key" ON "tb_store_bottle_types"("storeId", "bottleTypeId");

-- CreateIndex
CREATE INDEX "tb_customers_companyId_idx" ON "tb_customers"("companyId");

-- CreateIndex
CREATE INDEX "tb_customer_store_balances_storeId_idx" ON "tb_customer_store_balances"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_customer_store_balances_customerId_storeId_key" ON "tb_customer_store_balances"("customerId", "storeId");

-- CreateIndex
CREATE INDEX "tb_customer_payments_customerId_idx" ON "tb_customer_payments"("customerId");

-- CreateIndex
CREATE INDEX "tb_customer_payments_storeId_idx" ON "tb_customer_payments"("storeId");

-- CreateIndex
CREATE INDEX "tb_customer_payment_allocations_paymentId_idx" ON "tb_customer_payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "tb_customer_payment_allocations_storeId_idx" ON "tb_customer_payment_allocations"("storeId");

-- CreateIndex
CREATE INDEX "tb_customer_store_bottle_balances_storeId_idx" ON "tb_customer_store_bottle_balances"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_customer_store_bottle_balances_customerId_storeId_bottle_key" ON "tb_customer_store_bottle_balances"("customerId", "storeId", "bottleTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_sales_commandTabId_key" ON "tb_sales"("commandTabId");

-- CreateIndex
CREATE INDEX "tb_sales_storeId_idx" ON "tb_sales"("storeId");

-- CreateIndex
CREATE INDEX "tb_sales_customerId_idx" ON "tb_sales"("customerId");

-- CreateIndex
CREATE INDEX "tb_sale_items_saleId_idx" ON "tb_sale_items"("saleId");

-- CreateIndex
CREATE INDEX "tb_sale_items_storeProductId_idx" ON "tb_sale_items"("storeProductId");

-- CreateIndex
CREATE INDEX "tb_cash_registers_storeId_idx" ON "tb_cash_registers"("storeId");

-- CreateIndex
CREATE INDEX "tb_cash_movements_cashRegisterId_idx" ON "tb_cash_movements"("cashRegisterId");

-- CreateIndex
CREATE INDEX "tb_command_tabs_storeId_idx" ON "tb_command_tabs"("storeId");

-- CreateIndex
CREATE INDEX "tb_command_items_commandTabId_idx" ON "tb_command_items"("commandTabId");

-- CreateIndex
CREATE INDEX "tb_command_items_storeProductId_idx" ON "tb_command_items"("storeProductId");

-- CreateIndex
CREATE INDEX "tb_bottle_movements_storeId_idx" ON "tb_bottle_movements"("storeId");

-- CreateIndex
CREATE INDEX "tb_bottle_movements_bottleTypeId_idx" ON "tb_bottle_movements"("bottleTypeId");

-- CreateIndex
CREATE INDEX "tb_notifications_publishedAt_idx" ON "tb_notifications"("publishedAt");

-- CreateIndex
CREATE INDEX "tb_notification_reads_userId_idx" ON "tb_notification_reads"("userId");

-- CreateIndex
CREATE INDEX "ix_th_user_history_vigente" ON "th_user_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_company_history_vigente" ON "th_company_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_membership_history_vigente" ON "th_membership_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_organization_history_vigente" ON "th_organization_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_plan_history_vigente" ON "th_plan_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_store_history_vigente" ON "th_store_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_membership_store_history_vigente" ON "th_membership_store_history"("membershipId", "storeId", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_product_history_vigente" ON "th_product_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_store_product_history_vigente" ON "th_store_product_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_store_product_history_store" ON "th_store_product_history"("storeId");

-- CreateIndex
CREATE INDEX "ix_th_bottle_type_history_vigente" ON "th_bottle_type_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_store_bottle_type_history_vigente" ON "th_store_bottle_type_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_customer_history_vigente" ON "th_customer_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_customer_store_balance_history_vigente" ON "th_customer_store_balance_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_customer_payment_history_vigente" ON "th_customer_payment_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_customer_payment_allocation_history_vigente" ON "th_customer_payment_allocation_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_customer_store_bottle_balance_history_vigente" ON "th_customer_store_bottle_balance_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_sale_history_vigente" ON "th_sale_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_sale_item_history_vigente" ON "th_sale_item_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_cash_register_history_vigente" ON "th_cash_register_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_cash_movement_history_vigente" ON "th_cash_movement_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_command_tab_history_vigente" ON "th_command_tab_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_command_item_history_vigente" ON "th_command_item_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_bottle_movement_history_vigente" ON "th_bottle_movement_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_notification_history_vigente" ON "th_notification_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "ix_th_notification_read_history_vigente" ON "th_notification_read_history"("notificationId", "userId", "historyEnd");

-- AddForeignKey
ALTER TABLE "tb_companies" ADD CONSTRAINT "tb_companies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "tb_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_memberships" ADD CONSTRAINT "tb_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tb_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_memberships" ADD CONSTRAINT "tb_memberships_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "tb_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_organizations" ADD CONSTRAINT "tb_organizations_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "tb_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_organizations" ADD CONSTRAINT "tb_organizations_planId_fkey" FOREIGN KEY ("planId") REFERENCES "tb_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_stores" ADD CONSTRAINT "tb_stores_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "tb_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_membership_stores" ADD CONSTRAINT "tb_membership_stores_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "tb_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_membership_stores" ADD CONSTRAINT "tb_membership_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_products" ADD CONSTRAINT "tb_products_bottleTypeId_fkey" FOREIGN KEY ("bottleTypeId") REFERENCES "tb_bottle_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_products" ADD CONSTRAINT "tb_products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "tb_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_store_products" ADD CONSTRAINT "tb_store_products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_store_products" ADD CONSTRAINT "tb_store_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "tb_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_bottle_types" ADD CONSTRAINT "tb_bottle_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "tb_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_store_bottle_types" ADD CONSTRAINT "tb_store_bottle_types_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_store_bottle_types" ADD CONSTRAINT "tb_store_bottle_types_bottleTypeId_fkey" FOREIGN KEY ("bottleTypeId") REFERENCES "tb_bottle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_customers" ADD CONSTRAINT "tb_customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "tb_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_customer_store_balances" ADD CONSTRAINT "tb_customer_store_balances_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "tb_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_customer_store_balances" ADD CONSTRAINT "tb_customer_store_balances_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_customer_payments" ADD CONSTRAINT "tb_customer_payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "tb_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_customer_payments" ADD CONSTRAINT "tb_customer_payments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_customer_payment_allocations" ADD CONSTRAINT "tb_customer_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "tb_customer_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_customer_payment_allocations" ADD CONSTRAINT "tb_customer_payment_allocations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_customer_store_bottle_balances" ADD CONSTRAINT "tb_customer_store_bottle_balances_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "tb_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_customer_store_bottle_balances" ADD CONSTRAINT "tb_customer_store_bottle_balances_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_customer_store_bottle_balances" ADD CONSTRAINT "tb_customer_store_bottle_balances_bottleTypeId_fkey" FOREIGN KEY ("bottleTypeId") REFERENCES "tb_bottle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_sales" ADD CONSTRAINT "tb_sales_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_sales" ADD CONSTRAINT "tb_sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tb_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_sales" ADD CONSTRAINT "tb_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "tb_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_sales" ADD CONSTRAINT "tb_sales_commandTabId_fkey" FOREIGN KEY ("commandTabId") REFERENCES "tb_command_tabs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_sale_items" ADD CONSTRAINT "tb_sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "tb_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_sale_items" ADD CONSTRAINT "tb_sale_items_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "tb_store_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_cash_registers" ADD CONSTRAINT "tb_cash_registers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_cash_movements" ADD CONSTRAINT "tb_cash_movements_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "tb_cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_command_tabs" ADD CONSTRAINT "tb_command_tabs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_command_tabs" ADD CONSTRAINT "tb_command_tabs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "tb_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_command_items" ADD CONSTRAINT "tb_command_items_commandTabId_fkey" FOREIGN KEY ("commandTabId") REFERENCES "tb_command_tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_command_items" ADD CONSTRAINT "tb_command_items_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "tb_store_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_bottle_movements" ADD CONSTRAINT "tb_bottle_movements_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "tb_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_bottle_movements" ADD CONSTRAINT "tb_bottle_movements_bottleTypeId_fkey" FOREIGN KEY ("bottleTypeId") REFERENCES "tb_bottle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_bottle_movements" ADD CONSTRAINT "tb_bottle_movements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "tb_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_bottle_movements" ADD CONSTRAINT "tb_bottle_movements_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "tb_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_notifications" ADD CONSTRAINT "tb_notifications_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "tb_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_notification_reads" ADD CONSTRAINT "tb_notification_reads_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "tb_notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_notification_reads" ADD CONSTRAINT "tb_notification_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tb_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

