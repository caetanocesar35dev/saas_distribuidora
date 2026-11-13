-- AlterTable
ALTER TABLE "tb_products" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "packName" TEXT;

-- AlterTable
ALTER TABLE "th_product_history" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "packName" TEXT;

-- CreateTable
CREATE TABLE "tb_product_categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modifierId" TEXT,
    "modifiedEndpoint" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tb_product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "th_product_category_history" (
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

    CONSTRAINT "th_product_category_history_pkey" PRIMARY KEY ("historyId")
);

-- CreateIndex
CREATE INDEX "tb_product_categories_companyId_idx" ON "tb_product_categories"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "tb_product_categories_companyId_name_key" ON "tb_product_categories"("companyId", "name");

-- CreateIndex
CREATE INDEX "ix_th_product_category_history_vigente" ON "th_product_category_history"("id", "historyEnd");

-- CreateIndex
CREATE INDEX "tb_products_categoryId_idx" ON "tb_products"("categoryId");

-- AddForeignKey
ALTER TABLE "tb_products" ADD CONSTRAINT "tb_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "tb_product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_product_categories" ADD CONSTRAINT "tb_product_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "tb_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Auditoria e soft delete da tabela nova (mesmo padrão da migration auditoria_triggers).
CREATE TRIGGER tr_auditoria_tb_product_categories
AFTER INSERT OR UPDATE ON "tb_product_categories"
FOR EACH ROW EXECUTE FUNCTION fc_auditoria('th_product_category_history', 'id');

CREATE TRIGGER tr_bloqueia_delete_tb_product_categories
BEFORE DELETE ON "tb_product_categories"
FOR EACH ROW EXECUTE FUNCTION fc_bloqueia_delete();

-- As empresas que já existem ganham a lista sugerida (a mesma de DEFAULT_PRODUCT_CATEGORIES).
-- Os produtos delas continuam sem categoria até o gerente escolher.
INSERT INTO "tb_product_categories" ("id", "companyId", "name", "updatedAt", "modifierId", "modifiedEndpoint")
SELECT gen_random_uuid()::text, c."id", n."name", CURRENT_TIMESTAMP, 'system', 'migration:product_categories'
FROM "tb_companies" c
CROSS JOIN (VALUES ('Bebidas'), ('Cigarros'), ('Salgadinhos'), ('Mercearia'), ('Gelo e carvão')) AS n("name");

